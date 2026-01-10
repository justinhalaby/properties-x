import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { transformRawToCurated } from '@/lib/transformers/centris-rental-curated-transformer';
import { transformCuratedToRental } from '@/lib/transformers/centris-rental-transformer';
import { geocodeAddress } from '@/lib/geocoding/nominatim';
import type { CentrisRentalRaw } from '@/types/centris-rental-raw';

/**
 * POST /api/centris-rentals/transform
 * Transforms raw Centris data from Storage → CentrisRentalCurated → rental
 * Two-stage pipeline for better data quality and debugging
 *
 * Body: { centrisId: string }
 * Returns: { curated, rental, warnings, message }
 */
export async function POST(request: Request) {
  try {
    const { centrisId, force } = await request.json();

    if (!centrisId) {
      return NextResponse.json(
        { error: 'centrisId is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // 1. Fetch metadata
    const { data: metadata, error: metadataFetchError } = await supabase
      .from('centris_rentals_metadata')
      .select('*')
      .eq('centris_id', centrisId)
      .single();

    if (metadataFetchError || !metadata) {
      return NextResponse.json(
        { error: 'Metadata not found for centrisId: ' + centrisId },
        { status: 404 }
      );
    }

    // 2. Check if already transformed (has rental_id)
    if (metadata.rental_id && !force) {
      // Get rental details to show in the warning
      const { data: existingRental } = await supabase
        .from('rentals')
        .select('id, title, address, monthly_rent, created_at')
        .eq('id', metadata.rental_id)
        .single();

      return NextResponse.json(
        {
          alreadyTransformed: true,
          existingRental,
          message: 'This listing has already been transformed. Use force=true to re-transform.',
        },
        { status: 409 } // 409 Conflict
      );
    }

    // 2. Download raw JSON from Storage (use service role to bypass RLS)
    const supabaseServiceRole = createServiceRoleClient();
    const { data: fileData, error: downloadError } = await supabaseServiceRole.storage
      .from('centris-raw')
      .download(metadata.storage_path);

    if (downloadError || !fileData) {
      return NextResponse.json(
        { error: 'Raw data not found in storage at: ' + metadata.storage_path },
        { status: 404 }
      );
    }

    const rawJsonText = await fileData.text();
    const rawData: CentrisRentalRaw = JSON.parse(rawJsonText);

    // 3. Transform raw → curated
    const { curatedInput, warnings: curatedWarnings, errors: curatedErrors } =
      transformRawToCurated(rawData);

    // Add raw data storage path for traceability
    curatedInput.raw_data_storage_path = metadata.storage_path;

    const allWarnings: string[] = [...curatedWarnings];
    const allErrors: string[] = [...curatedErrors];

    if (curatedErrors.length > 0) {
      // Update transformation status
      await supabase
        .from('centris_rentals_metadata')
        .update({
          transformation_status: 'failed',
          transformation_error: curatedErrors.join('; '),
          transformation_attempts: metadata.transformation_attempts + 1,
        })
        .eq('id', metadata.id);

      return NextResponse.json(
        { error: 'Curated transformation failed', details: curatedErrors },
        { status: 400 }
      );
    }

    // 4. Insert or update CentrisRentalCurated table
    // Check if curated record already exists by centris_id
    const { data: existingCurated } = await supabase
      .from('CentrisRentalCurated')
      .select('id')
      .eq('centris_id', centrisId)
      .maybeSingle();

    let curated;
    let curatedError;

    if (existingCurated) {
      // Update existing curated record
      const { data, error } = await supabase
        .from('CentrisRentalCurated')
        .update(curatedInput)
        .eq('id', existingCurated.id)
        .select()
        .single();

      curated = data;
      curatedError = error;
    } else {
      // Insert new curated record
      const { data, error } = await supabase
        .from('CentrisRentalCurated')
        .insert(curatedInput)
        .select()
        .single();

      curated = data;
      curatedError = error;
    }

    if (curatedError || !curated) {
      console.error('Curated operation error:', curatedError);

      await supabase
        .from('centris_rentals_metadata')
        .update({
          transformation_status: 'failed',
          transformation_error: 'Failed to save curated record: ' + curatedError?.message,
          transformation_attempts: metadata.transformation_attempts + 1,
        })
        .eq('id', metadata.id);

      return NextResponse.json(
        { error: 'Failed to save curated record: ' + curatedError?.message },
        { status: 500 }
      );
    }

    // 5. Transform curated → rental
    const { rentalInput, warnings: rentalWarnings, errors: rentalErrors } =
      transformCuratedToRental(curated);

    allWarnings.push(...rentalWarnings);
    allErrors.push(...rentalErrors);

    if (rentalErrors.length > 0) {
      // Update transformation status
      await supabase
        .from('centris_rentals_metadata')
        .update({
          transformation_status: 'failed',
          transformation_error: rentalErrors.join('; '),
          transformation_attempts: metadata.transformation_attempts + 1,
          curated_id: curated.id, // Link to curated even if rental failed
        })
        .eq('id', metadata.id);

      return NextResponse.json(
        { error: 'Rental transformation failed', details: rentalErrors },
        { status: 400 }
      );
    }

    // 6. Geocode address (only if we don't already have coordinates from curated data)
    if (!rentalInput.latitude && !rentalInput.longitude && rentalInput.address) {
      try {
        const coords = await geocodeAddress(
          rentalInput.address,
          rentalInput.city || undefined,
          rentalInput.postal_code || undefined
        );

        if (coords) {
          rentalInput.latitude = coords.latitude;
          rentalInput.longitude = coords.longitude;
        } else {
          allWarnings.push('Could not geocode address');
        }
      } catch (geoError) {
        console.error('Geocoding error:', geoError);
        allWarnings.push('Geocoding failed');
      }
    }

    // 7. Use already-downloaded images from metadata
    const imageStoragePaths = metadata.images || [];
    if (imageStoragePaths.length === 0) {
      allWarnings.push('No images were downloaded during scraping');
    }

    // 8. Create or update rental with pre-downloaded images
    let rental;
    let rentalError;

    const rentalData = {
      ...rentalInput,
      images: imageStoragePaths,
      geocoded_at: rentalInput.latitude ? new Date().toISOString() : null,
      raw_data_storage_path: metadata.storage_path,
    };

    // Check if rental already exists by centris_id
    const { data: existingRentalBycentrisId } = await supabase
      .from('rentals')
      .select('id')
      .eq('centris_id', centrisId)
      .maybeSingle();

    // If rental exists (either from metadata or by centris_id), UPDATE it
    if (existingRentalBycentrisId || (force && metadata.rental_id)) {
      const rentalIdToUpdate = existingRentalBycentrisId?.id || metadata.rental_id;

      const { data, error } = await supabase
        .from('rentals')
        .update(rentalData)
        .eq('id', rentalIdToUpdate)
        .select()
        .single();

      rental = data;
      rentalError = error;
    } else {
      // New transformation - INSERT
      const { data, error } = await supabase
        .from('rentals')
        .insert(rentalData)
        .select()
        .single();

      rental = data;
      rentalError = error;
    }

    if (rentalError || !rental) {
      console.error('Rental operation error:', rentalError);

      // Update transformation status
      await supabase
        .from('centris_rentals_metadata')
        .update({
          transformation_status: 'failed',
          transformation_error: 'Failed to save rental: ' + rentalError?.message,
          transformation_attempts: metadata.transformation_attempts + 1,
          curated_id: curated.id, // Link to curated even if rental failed
        })
        .eq('id', metadata.id);

      return NextResponse.json(
        { error: 'Failed to save rental: ' + rentalError?.message },
        { status: 500 }
      );
    }

    // 9. Update metadata table with both curated_id and rental_id
    await supabase
      .from('centris_rentals_metadata')
      .update({
        transformation_status: 'success',
        transformed_at: new Date().toISOString(),
        curated_id: curated.id,
        rental_id: rental.id,
      })
      .eq('id', metadata.id);

    return NextResponse.json({
      curated,
      rental,
      warnings: allWarnings.length > 0 ? allWarnings : undefined,
      message: (existingCurated || existingRentalBycentrisId)
        ? `Re-transformation successful: ${existingCurated ? 'Updated' : 'Created'} curated record and ${existingRentalBycentrisId ? 'updated' : 'created'} rental`
        : 'Two-stage transformation successful (raw → curated → rental)',
    });
  } catch (error) {
    console.error('Unexpected error in transform endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to transform rental' },
      { status: 500 }
    );
  }
}
