import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { CentrisRentalScraper } from '@/lib/scrapers/centris-rental-scraper';
import { processMediaArray } from '@/lib/storage/rental-media';
import type { CentrisRentalRaw } from '@/types/centris-rental-raw';

/**
 * POST /api/centris-rentals/scrape
 * Scrapes Centris rental URL and saves raw JSON to Storage + metadata to table
 *
 * Body: { url: string }
 * Returns: { metadataId, centrisId, storagePath, message }
 */
export async function POST(request: Request) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    const startTime = Date.now();

    // 1. Scrape using CentrisRentalScraper
    const scraper = new CentrisRentalScraper();

    if (!scraper.canHandle(url)) {
      return NextResponse.json(
        { error: 'Invalid Centris rental URL. Must contain ~a-louer~' },
        { status: 400 }
      );
    }

    let rawData;
    try {
      rawData = await scraper.scrape(url);
    } catch (scrapeError: any) {
      return NextResponse.json(
        { error: 'Failed to scrape listing: ' + scrapeError.message },
        { status: 500 }
      );
    }

    const centrisId = rawData.centris_id;
    const supabase = await createClient();

    // 2. Check for duplicate
    const { data: existing } = await supabase
      .from('centris_rentals_metadata')
      .select('id, centris_id, transformation_status, rental_id')
      .eq('centris_id', centrisId)
      .single();

    if (existing) {
      return NextResponse.json({
        message: 'Listing already scraped',
        metadataId: existing.id,
        centrisId: existing.centris_id,
        status: existing.transformation_status,
        rentalId: existing.rental_id,
        alreadyExists: true,
      });
    }

    // 3. Upload raw JSON to Storage with date-based partitioning
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const storagePath = `${year}/${month}/${centrisId}.json`;

    const rawJson: CentrisRentalRaw = {
      centris_id: centrisId,
      source_url: url,
      scraped_at: now.toISOString(),
      scraper_version: '1.0',
      raw_data: {
        listing_id: rawData.listing_id,
        property_type: rawData.property_type,
        address: rawData.address,
        price: rawData.price,
        price_currency: rawData.price_currency,
        price_display: rawData.price_display,
        latitude: rawData.latitude,
        longitude: rawData.longitude,
        rooms: rawData.rooms,
        bedrooms: rawData.bedrooms,
        bathrooms: rawData.bathrooms,
        characteristics: rawData.characteristics,
        description: rawData.description,
        walk_score: rawData.walk_score,
        images: rawData.images,
        brokers: rawData.brokers,
      },
      html_snippet: rawData.html_snippet,
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
        { error: 'Failed to upload raw data to storage: ' + uploadError.message },
        { status: 500 }
      );
    }

    // 4. Download images to storage using centris_id as identifier
    let imageStoragePaths: string[] = [];
    const imageUrls = rawData.images || [];

    if (imageUrls.length > 0) {
      try {
        const imageResult = await processMediaArray(
          imageUrls,
          centrisId, // Use centris_id as identifier
          'image',
          'centris' // Storage path: rentals/centris/{centris_id}/image-{index}.jpg
        );
        imageStoragePaths = imageResult.storagePaths;
      } catch (imageError) {
        console.error('Image download error:', imageError);
        // Continue even if images fail - we can retry later
      }
    }

    // 5. Insert metadata into table
    const { data: metadata, error: metadataError } = await supabase
      .from('centris_rentals_metadata')
      .insert({
        centris_id: centrisId,
        source_url: url,
        storage_path: storagePath,
        raw_data_size_bytes: new Blob([rawJsonStr]).size,
        scrape_status: 'success',
        scrape_duration_ms: Date.now() - startTime,
        title_preview: rawData.property_type?.substring(0, 100) || null,
        price_preview: rawData.price_display || rawData.price,
        address_preview: rawData.address,
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
      message: 'Scraped successfully. Ready for transformation.',
      preview: {
        title: metadata.title_preview,
        price: metadata.price_preview,
        address: metadata.address_preview,
      },
      imageCount: imageStoragePaths.length,
    });
  } catch (error) {
    console.error('Unexpected error in scrape endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to scrape rental' },
      { status: 500 }
    );
  }
}
