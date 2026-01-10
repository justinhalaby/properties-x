import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';

/**
 * GET /api/rentals/[id]/raw-json
 * Fetches the raw Centris JSON from storage for a rental
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // 1. Get the rental to find the centris_id
    const { data: rental, error: rentalError } = await supabase
      .from('rentals')
      .select('centris_id')
      .eq('id', id)
      .single();

    if (rentalError || !rental) {
      return NextResponse.json(
        { error: 'Rental not found' },
        { status: 404 }
      );
    }

    if (!rental.centris_id) {
      return NextResponse.json(
        { error: 'This rental does not have Centris raw data' },
        { status: 404 }
      );
    }

    // 2. Get the storage path from centris_rentals_metadata
    const { data: metadata, error: metadataError } = await supabase
      .from('centris_rentals_metadata')
      .select('storage_path')
      .eq('centris_id', rental.centris_id)
      .single();

    if (metadataError || !metadata) {
      return NextResponse.json(
        { error: 'Metadata not found for this rental' },
        { status: 404 }
      );
    }

    // 3. Download the raw JSON from storage using service role client
    const supabaseServiceRole = createServiceRoleClient();
    const { data: jsonData, error: downloadError } = await supabaseServiceRole.storage
      .from('centris-raw')
      .download(metadata.storage_path);

    if (downloadError) {
      console.error('Storage download error:', downloadError);
      return NextResponse.json(
        { error: 'Failed to download raw data from storage' },
        { status: 500 }
      );
    }

    // 4. Parse and return the JSON
    const text = await jsonData.text();
    const rawJson = JSON.parse(text);

    return NextResponse.json({ data: rawJson });
  } catch (error) {
    console.error('Error fetching raw JSON:', error);
    return NextResponse.json(
      { error: 'Failed to fetch raw JSON' },
      { status: 500 }
    );
  }
}
