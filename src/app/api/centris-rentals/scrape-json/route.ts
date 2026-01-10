import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { processMediaArray } from '@/lib/storage/rental-media';
import type { CentrisRentalRaw } from '@/types/centris-rental-raw';

/**
 * POST /api/centris-rentals/scrape-json
 * Accepts JSON from browser console script and saves to Storage + metadata
 *
 * Body: { jsonData: object } - JSON from consoleScrape/centris-rentals.js
 * Returns: { metadataId, centrisId, storagePath, message }
 */
export async function POST(request: Request) {
  try {
    const { jsonData } = await request.json();

    if (!jsonData) {
      return NextResponse.json(
        { error: 'jsonData is required' },
        { status: 400 }
      );
    }

    // Extract centris_id from various possible formats
    let centrisId: string | null = null;
    let sourceUrl: string | null = null;

    // New format: { centris_id, source_url, raw_data }
    if (jsonData.centris_id) {
      centrisId = jsonData.centris_id;
      sourceUrl = jsonData.source_url;
    }
    // Legacy format: { listingId, sourceUrl, ... }
    else if (jsonData.listingId) {
      centrisId = jsonData.listingId;
      sourceUrl = jsonData.sourceUrl;
    }
    // Try to extract from URL if provided
    else if (jsonData.sourceUrl || jsonData.source_url) {
      const url = jsonData.sourceUrl || jsonData.source_url;
      const match = url.match(/\/(\d+)(?:\?|$)/);
      if (match) {
        centrisId = match[1];
        sourceUrl = url;
      }
    }

    if (!centrisId) {
      return NextResponse.json(
        { error: 'JSON must contain centris_id or listingId field' },
        { status: 400 }
      );
    }

    if (!sourceUrl) {
      return NextResponse.json(
        { error: 'JSON must contain source_url or sourceUrl field' },
        { status: 400 }
      );
    }

    const startTime = Date.now();
    const supabase = await createClient();

    // Check for duplicate
    const { data: existing } = await supabase
      .from('centris_rentals_metadata')
      .select('id, transformation_status, rental_id')
      .eq('centris_id', centrisId)
      .single();

    if (existing) {
      return NextResponse.json({
        message: 'Listing already imported',
        metadataId: existing.id,
        status: existing.transformation_status,
        rentalId: existing.rental_id,
        alreadyExists: true,
      });
    }

    // Upload raw JSON to Storage with date-based partitioning
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const storagePath = `${year}/${month}/${centrisId}.json`;

    // Normalize JSON to required structure
    // If it's already wrapped in raw_data structure (new format)
    const normalizedRawData = jsonData.raw_data || {
      // Legacy format - convert camelCase to snake_case
      listing_id: jsonData.listingId,
      property_type: jsonData.propertyType,
      address: jsonData.address,
      price: jsonData.price,
      price_currency: jsonData.priceCurrency,
      price_display: jsonData.priceDisplay,
      latitude: jsonData.coordinates?.latitude,
      longitude: jsonData.coordinates?.longitude,
      rooms: jsonData.rooms,
      bedrooms: jsonData.bedrooms,
      bathrooms: jsonData.bathrooms,
      characteristics: jsonData.characteristics || {},
      description: jsonData.description,
      walk_score: jsonData.walkScore,
      images: jsonData.images || [],
      brokers: jsonData.brokers || [],
    };

    const rawJson: CentrisRentalRaw = {
      centris_id: centrisId,
      source_url: sourceUrl,
      scraped_at: jsonData.scrapedAt || jsonData.extracted_at || now.toISOString(),
      scraper_version: '1.0-console',
      raw_data: normalizedRawData,
      html_snippet: null, // Console script doesn't capture HTML
    };

    const rawJsonStr = JSON.stringify(rawJson, null, 2);

    // Use service role client for storage operations (bypasses RLS)
    const supabaseServiceRole = createServiceRoleClient();
    const { error: uploadError } = await supabaseServiceRole.storage
      .from('centris-raw')
      .upload(storagePath, rawJsonStr, {
        contentType: 'application/json',
        upsert: false,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload data to storage: ' + uploadError.message },
        { status: 500 }
      );
    }

    // Extract preview data
    const titlePreview = rawJson.raw_data.property_type?.substring(0, 100) ||
                        rawJson.raw_data.title_raw?.substring(0, 100) ||
                        null;
    const pricePreview = rawJson.raw_data.price_display || rawJson.raw_data.price_raw || rawJson.raw_data.price;
    const addressPreview = rawJson.raw_data.address_raw || rawJson.raw_data.address;

    // Download images to storage using centris_id as temporary identifier
    let imageStoragePaths: string[] = [];
    const imageUrls = rawJson.raw_data.images || [];

    if (imageUrls.length > 0) {
      try {
        const imageResult = await processMediaArray(
          imageUrls,
          centrisId, // Use centris_id as identifier (will use this same ID later)
          'image',
          'centris' // Storage path: rentals/centris/{centris_id}/image-{index}.jpg
        );
        imageStoragePaths = imageResult.storagePaths;
      } catch (imageError) {
        console.error('Image download error:', imageError);
        // Continue even if images fail - we can retry later
      }
    }

    // Insert metadata into table
    const { data: metadata, error: metadataError } = await supabase
      .from('centris_rentals_metadata')
      .insert({
        centris_id: centrisId,
        source_url: jsonData.source_url,
        storage_path: storagePath,
        raw_data_size_bytes: new Blob([rawJsonStr]).size,
        scrape_status: 'success',
        scrape_duration_ms: Date.now() - startTime,
        title_preview: titlePreview,
        price_preview: pricePreview,
        address_preview: addressPreview,
        images: imageStoragePaths,
      })
      .select()
      .single();

    if (metadataError || !metadata) {
      console.error('Metadata insert error:', metadataError);
      return NextResponse.json(
        { error: 'Failed to save metadata: ' + metadataError?.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      metadataId: metadata.id,
      centrisId: metadata.centris_id,
      storagePath: metadata.storage_path,
      message: 'JSON imported successfully. Ready for transformation.',
      preview: {
        title: metadata.title_preview,
        price: metadata.price_preview,
        address: metadata.address_preview,
      },
      imageCount: imageStoragePaths.length,
    });
  } catch (error) {
    console.error('Unexpected error in scrape-json endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to import JSON data' },
      { status: 500 }
    );
  }
}
