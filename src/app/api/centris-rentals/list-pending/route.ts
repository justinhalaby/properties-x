import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/centris-rentals/list-pending
 * Lists all pending transformations
 *
 * Returns: { data: CentrisRentalMetadata[] }
 */
export async function GET() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from('centris_rentals_metadata')
      .select('*')
      .eq('transformation_status', 'pending')
      .order('scraped_at', { ascending: false });

    if (error) {
      console.error('Error fetching pending transformations:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error('Unexpected error in list-pending endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pending transformations' },
      { status: 500 }
    );
  }
}
