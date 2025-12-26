import { createClient } from "@/lib/supabase/server";
import { parseAddress } from "./address-parser";
import { classifyShareholderType, extractNEQFromName } from "./owner-matcher";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ScrapedCompanyData,
  CompanyInsert,
  ShareholderInsert,
  AdministratorInsert,
} from "@/types/company-registry";

/**
 * Saves scraped company data to the database
 *
 * This function performs a transactional save of:
 * 1. Company record
 * 2. All shareholders
 * 3. All administrators
 *
 * @param scrapedData - The data scraped from the Quebec business registry
 * @param supabaseClient - Optional Supabase client (for use outside of Next.js request context)
 * @returns The company ID of the saved company
 * @throws Error if any part of the save fails
 */
export async function saveCompanyData(
  scrapedData: ScrapedCompanyData,
  supabaseClient?: SupabaseClient
): Promise<string> {
  const supabase = supabaseClient || await createClient();

  // Parse domicile address
  const parsedDomicile = parseAddress(scrapedData.identification.domicile_address);

  // 1. Insert company
  const companyInsert: CompanyInsert = {
    neq: scrapedData.neq,
    company_name: scrapedData.identification.name,
    company_status: scrapedData.identification.status,
    domicile_address: scrapedData.identification.domicile_address,
    domicile_street_number: parsedDomicile.street_number,
    domicile_street_name: parsedDomicile.street_name,
    domicile_city: parsedDomicile.city,
    domicile_province: parsedDomicile.province,
    domicile_postal_code: parsedDomicile.postal_code,
    registration_date: scrapedData.identification.registration_date || null,
    status_date: scrapedData.identification.status_date || null,
    cae_code: scrapedData.economic_activity.cae_code || null,
    cae_description: scrapedData.economic_activity.cae_description || null,
    source_url: scrapedData.source_url,
  };

  const { data: company, error: companyError } = await supabase
    .from('companies')
    .insert(companyInsert)
    .select()
    .single();

  if (companyError) {
    console.error('Failed to insert company:', companyError);
    throw new Error(`Failed to save company: ${companyError.message}`);
  }

  console.log(`✓ Saved company: ${company.company_name} (${company.neq})`);

  // 2. Insert shareholders
  if (scrapedData.shareholders.length > 0) {
    const shareholderInserts: ShareholderInsert[] = scrapedData.shareholders.map((s) => {
      const parsed = parseAddress(s.address);
      const shareholderType = classifyShareholderType(s.name);
      const shareholderNEQ = shareholderType === 'corporate' ? extractNEQFromName(s.name) : null;

      return {
        company_id: company.id,
        shareholder_name: s.name,
        shareholder_type: shareholderType,
        shareholder_neq: shareholderNEQ,
        position: s.position,
        is_majority_shareholder: s.is_majority,
        address: s.address,
        street_number: parsed.street_number,
        street_name: parsed.street_name,
        unit: parsed.unit,
        city: parsed.city,
        province: parsed.province,
        postal_code: parsed.postal_code,
        address_publishable: parsed.publishable,
      };
    });

    const { error: shareholdersError } = await supabase
      .from('company_shareholders')
      .insert(shareholderInserts);

    if (shareholdersError) {
      console.error('Failed to insert shareholders:', shareholdersError);
      // Attempt to rollback company insert
      await supabase.from('companies').delete().eq('id', company.id);
      throw new Error(`Failed to save shareholders: ${shareholdersError.message}`);
    }

    console.log(`✓ Saved ${shareholderInserts.length} shareholder(s)`);
  } else {
    console.log('No shareholders to save');
  }

  // 3. Insert administrators
  if (scrapedData.administrators.length > 0) {
    const administratorInserts: AdministratorInsert[] = scrapedData.administrators.map((a) => {
      // Only parse addresses if they're not empty
      const parsedProfessional = a.professional_address ? parseAddress(a.professional_address) : null;
      const parsedDomicile = a.domicile_address ? parseAddress(a.domicile_address) : null;

      return {
        company_id: company.id,
        administrator_name: a.name,
        position_title: a.position_title,
        position_order: a.position_order,
        // Domicile address (NULL if not provided)
        domicile_address: a.domicile_address || null,
        domicile_street_number: parsedDomicile?.street_number || null,
        domicile_street_name: parsedDomicile?.street_name || null,
        domicile_unit: parsedDomicile?.unit || null,
        domicile_city: parsedDomicile?.city || null,
        domicile_province: parsedDomicile?.province || null,
        domicile_postal_code: parsedDomicile?.postal_code || null,
        domicile_address_publishable: parsedDomicile?.publishable ?? true,
        // Professional address
        professional_address: a.professional_address || null,
        professional_street_number: parsedProfessional?.street_number || null,
        professional_street_name: parsedProfessional?.street_name || null,
        professional_unit: parsedProfessional?.unit || null,
        professional_city: parsedProfessional?.city || null,
        professional_province: parsedProfessional?.province || null,
        professional_postal_code: parsedProfessional?.postal_code || null,
        address_publishable: parsedProfessional?.publishable ?? true,
      };
    });

    const { error: administratorsError } = await supabase
      .from('company_administrators')
      .insert(administratorInserts);

    if (administratorsError) {
      console.error('Failed to insert administrators:', administratorsError);
      // Attempt to rollback company and shareholders
      await supabase.from('companies').delete().eq('id', company.id);
      throw new Error(`Failed to save administrators: ${administratorsError.message}`);
    }

    console.log(`✓ Saved ${administratorInserts.length} administrator(s)`);
  } else {
    console.log('No administrators to save');
  }

  console.log(`✓ Successfully saved complete company data for ${company.company_name}`);

  return company.id;
}

/**
 * Updates the last_verified_at timestamp for a company
 *
 * @param companyId - The company ID
 */
export async function markCompanyAsVerified(companyId: string): Promise<void> {
  const supabase = await createClient();

  const { error } = await supabase
    .from('companies')
    .update({ last_verified_at: new Date().toISOString() })
    .eq('id', companyId);

  if (error) {
    console.error('Failed to update last_verified_at:', error);
    throw new Error(`Failed to mark company as verified: ${error.message}`);
  }
}

/**
 * Re-scrapes and updates an existing company's data
 * This will DELETE and re-insert shareholders and administrators
 *
 * @param companyId - The company ID to update
 * @param scrapedData - Fresh scraped data
 */
export async function updateCompanyData(
  companyId: string,
  scrapedData: ScrapedCompanyData
): Promise<void> {
  const supabase = await createClient();

  // Parse domicile address
  const parsedDomicile = parseAddress(scrapedData.identification.domicile_address);

  // Update company record
  const { error: updateError } = await supabase
    .from('companies')
    .update({
      company_status: scrapedData.identification.status,
      domicile_address: scrapedData.identification.domicile_address,
      domicile_street_number: parsedDomicile.street_number,
      domicile_street_name: parsedDomicile.street_name,
      domicile_city: parsedDomicile.city,
      domicile_province: parsedDomicile.province,
      domicile_postal_code: parsedDomicile.postal_code,
      status_date: scrapedData.identification.status_date || null,
      cae_code: scrapedData.economic_activity.cae_code || null,
      cae_description: scrapedData.economic_activity.cae_description || null,
      last_verified_at: new Date().toISOString(),
    })
    .eq('id', companyId);

  if (updateError) {
    throw new Error(`Failed to update company: ${updateError.message}`);
  }

  // Delete old shareholders and administrators (CASCADE will handle this)
  // Then re-insert new ones
  await supabase.from('company_shareholders').delete().eq('company_id', companyId);
  await supabase.from('company_administrators').delete().eq('company_id', companyId);

  // Re-insert shareholders
  if (scrapedData.shareholders.length > 0) {
    const shareholderInserts: ShareholderInsert[] = scrapedData.shareholders.map((s) => {
      const parsed = parseAddress(s.address);
      const shareholderType = classifyShareholderType(s.name);
      const shareholderNEQ = shareholderType === 'corporate' ? extractNEQFromName(s.name) : null;

      return {
        company_id: companyId,
        shareholder_name: s.name,
        shareholder_type: shareholderType,
        shareholder_neq: shareholderNEQ,
        position: s.position,
        is_majority_shareholder: s.is_majority,
        address: s.address,
        street_number: parsed.street_number,
        street_name: parsed.street_name,
        unit: parsed.unit,
        city: parsed.city,
        province: parsed.province,
        postal_code: parsed.postal_code,
        address_publishable: parsed.publishable,
      };
    });

    await supabase.from('company_shareholders').insert(shareholderInserts);
  }

  // Re-insert administrators
  if (scrapedData.administrators.length > 0) {
    const administratorInserts: AdministratorInsert[] = scrapedData.administrators.map((a) => {
      // Only parse addresses if they're not empty
      const parsedProfessional = a.professional_address ? parseAddress(a.professional_address) : null;
      const parsedDomicile = a.domicile_address ? parseAddress(a.domicile_address) : null;

      return {
        company_id: companyId,
        administrator_name: a.name,
        position_title: a.position_title,
        position_order: a.position_order,
        // Domicile address (NULL if not provided)
        domicile_address: a.domicile_address || null,
        domicile_street_number: parsedDomicile?.street_number || null,
        domicile_street_name: parsedDomicile?.street_name || null,
        domicile_unit: parsedDomicile?.unit || null,
        domicile_city: parsedDomicile?.city || null,
        domicile_province: parsedDomicile?.province || null,
        domicile_postal_code: parsedDomicile?.postal_code || null,
        domicile_address_publishable: parsedDomicile?.publishable ?? true,
        // Professional address
        professional_address: a.professional_address || null,
        professional_street_number: parsedProfessional?.street_number || null,
        professional_street_name: parsedProfessional?.street_name || null,
        professional_unit: parsedProfessional?.unit || null,
        professional_city: parsedProfessional?.city || null,
        professional_province: parsedProfessional?.province || null,
        professional_postal_code: parsedProfessional?.postal_code || null,
        address_publishable: parsedProfessional?.publishable ?? true,
      };
    });

    await supabase.from('company_administrators').insert(administratorInserts);
  }

  console.log(`✓ Successfully updated company data`);
}
