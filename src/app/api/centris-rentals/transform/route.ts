import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { transformCentrisRawToRental } from '@/lib/transformers/centris-rental-transformer';
import { geocodeAddress } from '@/lib/geocoding/nominatim';
import { processMediaArray } from '@/lib/storage/rental-media';
import type { CentrisRentalRaw } from '@/types/centris-rental-raw';

/**
 * POST /api/centris-rentals/transform
 * Transforms raw Centris data from Storage to rental
 *
 * Body: { centrisId: string }
 * Returns: { rental, warnings, message }
 */
export async function POST(request: Request) {
  try {
    const { centrisId } = await request.json();

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

    // 3. Transform
    const { rentalInput, warnings, errors } =
      transformCentrisRawToRental(rawData);

    if (errors.length > 0) {
      // Update transformation status
      await supabase
        .from('centris_rentals_metadata')
        .update({
          transformation_status: 'failed',
          transformation_error: errors.join('; '),
          transformation_attempts: metadata.transformation_attempts + 1,
        })
        .eq('id', metadata.id);

      return NextResponse.json(
        { error: 'Transformation failed', details: errors },
        { status: 400 }
      );
    }

    // 4. Geocode address (only if we don't already have coordinates from structured data)
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
          warnings.push('Could not geocode address');
        }
      } catch (geoError) {
        console.error('Geocoding error:', geoError);
        warnings.push('Geocoding failed');
      }
    }

    // 5. Use already-downloaded images from metadata
    const imageStoragePaths = metadata.images || [];
    if (imageStoragePaths.length === 0) {
      warnings.push('No images were downloaded during scraping');
    }

    // 6. Create rental with pre-downloaded images
    const { data: rental, error: rentalError } = await supabase
      .from('rentals')
      .insert({
        ...rentalInput,
        images: imageStoragePaths,
        geocoded_at: rentalInput.latitude ? new Date().toISOString() : null,
      })
      .select()
      .single();

    if (rentalError || !rental) {
      console.error('Rental insert error:', rentalError);

      // Update transformation status
      await supabase
        .from('centris_rentals_metadata')
        .update({
          transformation_status: 'failed',
          transformation_error: 'Failed to create rental: ' + rentalError?.message,
          transformation_attempts: metadata.transformation_attempts + 1,
        })
        .eq('id', metadata.id);

      return NextResponse.json(
        { error: 'Failed to create rental: ' + rentalError?.message },
        { status: 500 }
      );
    }

    // 7. Update metadata table
    await supabase
      .from('centris_rentals_metadata')
      .update({
        transformation_status: 'success',
        transformed_at: new Date().toISOString(),
        rental_id: rental.id,
      })
      .eq('id', metadata.id);

    return NextResponse.json({
      rental,
      warnings: warnings.length > 0 ? warnings : undefined,
      message: 'Transformation successful',
    });
  } catch (error) {
    console.error('Unexpected error in transform endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to transform rental' },
      { status: 500 }
    );
  }
}
