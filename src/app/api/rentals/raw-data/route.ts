import { NextResponse } from 'next/server';
import { createServiceRoleClient } from '@/lib/supabase/server';

/**
 * GET /api/rentals/raw-data?path={storage_path}&bucket={bucket_name}
 * Returns the raw JSON data from storage
 *
 * Query params:
 * - path: Storage path (e.g., "2026/01/123456789.json")
 * - bucket: Bucket name (e.g., "facebook-raw-rentals" or "centris-raw")
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path');
    const bucket = searchParams.get('bucket');

    if (!path) {
      return NextResponse.json(
        { error: 'path query parameter is required' },
        { status: 400 }
      );
    }

    if (!bucket) {
      return NextResponse.json(
        { error: 'bucket query parameter is required' },
        { status: 400 }
      );
    }

    // Validate bucket name (security check)
    const allowedBuckets = ['facebook-raw-rentals', 'centris-raw'];
    if (!allowedBuckets.includes(bucket)) {
      return NextResponse.json(
        { error: 'Invalid bucket name' },
        { status: 400 }
      );
    }

    // Use service role client to bypass RLS
    const supabase = createServiceRoleClient();

    const { data: fileData, error: downloadError } = await supabase.storage
      .from(bucket)
      .download(path);

    if (downloadError || !fileData) {
      return NextResponse.json(
        { error: 'File not found in storage', details: downloadError?.message },
        { status: 404 }
      );
    }

    const rawJsonText = await fileData.text();
    const rawData = JSON.parse(rawJsonText);

    return NextResponse.json(rawData);
  } catch (error) {
    console.error('Error fetching raw data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch raw data' },
      { status: 500 }
    );
  }
}
