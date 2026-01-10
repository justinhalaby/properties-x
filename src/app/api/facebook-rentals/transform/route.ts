import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { transformRawToCurated } from '@/lib/transformers/facebook-rental-curated-transformer';
import { transformCuratedToRental } from '@/lib/transformers/facebook-rental-transformer';
import { geocodeAddress } from '@/lib/geocoding/nominatim';
import type { FacebookRentalRaw } from '@/types/facebook-rental-raw';

/**
 * POST /api/facebook-rentals/transform
 * Transforms raw Facebook data from Storage → FacebookRentalCurated → rental
 * Two-stage pipeline for better data quality and debugging
 *
 * Body: { facebookId: string, force?: boolean }
 * Returns: { curated, rental, warnings, message }
 */
export async function POST(request: Request) {
  try {
    const { facebookId, force } = await request.json();

    if (!facebookId) {
      return NextResponse.json(
        { error: 'facebookId is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // 1. Fetch metadata
    const { data: metadata, error: metadataFetchError } = await supabase
      .from('facebook_rentals_metadata')
      .select('*')
      .eq('facebook_id', facebookId)
      .single();

    if (metadataFetchError || !metadata) {
      return NextResponse.json(
        { error: 'Metadata not found for facebookId: ' + facebookId },
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

    // 3. Download raw JSON from Storage (use service role to bypass RLS)
    const supabaseServiceRole = createServiceRoleClient();
    const { data: fileData, error: downloadError } = await supabaseServiceRole.storage
      .from('facebook-raw-rentals')
      .download(metadata.storage_path);

    if (downloadError || !fileData) {
      return NextResponse.json(
        { error: 'Raw data not found in storage at: ' + metadata.storage_path },
        { status: 404 }
      );
    }

    const rawJsonText = await fileData.text();
    const rawData: FacebookRentalRaw = JSON.parse(rawJsonText);

    // 4. Transform raw → curated (Stage 1)
    const { curatedInput, warnings: curatedWarnings, errors: curatedErrors } =
      transformRawToCurated(rawData);

    // Add raw data storage path for traceability
    curatedInput.raw_data_storage_path = metadata.storage_path;

    const allWarnings: string[] = [...curatedWarnings];
    const allErrors: string[] = [...curatedErrors];

    if (curatedErrors.length > 0) {
      // Update transformation status
      await supabase
        .from('facebook_rentals_metadata')
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

    // 5. Insert or update FacebookRentalCurated table
    // Check if curated record already exists by facebook_id
    const { data: existingCurated } = await supabase
      .from('FacebookRentalCurated')
      .select('id')
      .eq('facebook_id', facebookId)
      .maybeSingle();

    let curated;
    let curatedError;

    if (existingCurated) {
      // Update existing curated record
      const { data, error } = await supabase
        .from('FacebookRentalCurated')
        .update(curatedInput)
        .eq('id', existingCurated.id)
        .select()
        .single();

      curated = data;
      curatedError = error;
    } else {
      // Insert new curated record
      const { data, error } = await supabase
        .from('FacebookRentalCurated')
        .insert(curatedInput)
        .select()
        .single();

      curated = data;
      curatedError = error;
    }

    if (curatedError || !curated) {
      console.error('Curated operation error:', curatedError);

      await supabase
        .from('facebook_rentals_metadata')
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

    // 6. Transform curated → rental (Stage 2)
    const { rentalInput, warnings: rentalWarnings, errors: rentalErrors } =
      transformCuratedToRental(curated);

    allWarnings.push(...rentalWarnings);
    allErrors.push(...rentalErrors);

    if (rentalErrors.length > 0) {
      // Update transformation status
      await supabase
        .from('facebook_rentals_metadata')
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

    // 7. Geocode address (only if we don't already have coordinates from curated data)
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

    // 8. Use already-downloaded images/videos from metadata
    const imageStoragePaths = metadata.images || [];
    const videoStoragePaths = metadata.videos || [];
    if (imageStoragePaths.length === 0 && videoStoragePaths.length === 0) {
      allWarnings.push('No media was downloaded during scraping');
    }

    // 9. Create or update rental with pre-downloaded media
    let rental;
    let rentalError;

    const rentalData = {
      ...rentalInput,
      images: imageStoragePaths,
      videos: videoStoragePaths,
      geocoded_at: rentalInput.latitude ? new Date().toISOString() : null,
      raw_data_storage_path: metadata.storage_path,
    };

    // Check if rental already exists by facebook_id
    const { data: existingRentalByFacebookId } = await supabase
      .from('rentals')
      .select('id')
      .eq('facebook_id', facebookId)
      .maybeSingle();

    // If rental exists (either from metadata or by facebook_id), UPDATE it
    if (existingRentalByFacebookId || (force && metadata.rental_id)) {
      const rentalIdToUpdate = existingRentalByFacebookId?.id || metadata.rental_id;

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
        .from('facebook_rentals_metadata')
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

    // 10. Update metadata table with both curated_id and rental_id
    await supabase
      .from('facebook_rentals_metadata')
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
      message: (existingCurated || existingRentalByFacebookId)
        ? `Re-transformation successful: ${existingCurated ? 'Updated' : 'Created'} curated record and ${existingRentalByFacebookId ? 'updated' : 'created'} rental`
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
