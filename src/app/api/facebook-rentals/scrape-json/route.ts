import { NextResponse } from 'next/server';
import { createClient, createServiceRoleClient } from '@/lib/supabase/server';
import { processMediaArray } from '@/lib/storage/rental-media';
import type { FacebookRentalRaw } from '@/types/facebook-rental-raw';
import type { FacebookRental } from '@/types/rental';

/**
 * POST /api/facebook-rentals/scrape-json
 * Accepts JSON from browser console script and saves to Storage + metadata
 *
 * Body: { jsonData: FacebookRental } - JSON from consoleScrape/fb-rentals-v2.js
 * Returns: { metadataId, facebookId, storagePath, message, preview }
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

    // Handle both new format (with facebook_id/raw_data) and old format (flat structure)
    const isNewFormat = 'facebook_id' in jsonData && 'raw_data' in jsonData;
    const facebookId = isNewFormat ? jsonData.facebook_id : jsonData.id;
    const sourceUrl = isNewFormat ? jsonData.source_url : jsonData.url;
    const extractedDate = isNewFormat ? jsonData.extracted_date : jsonData.extractedDate;
    const scraperVersion = isNewFormat ? jsonData.scraper_version : 'console-v1';
    const rawDataContent = isNewFormat ? jsonData.raw_data : jsonData;

    if (!facebookId) {
      return NextResponse.json(
        { error: 'JSON must contain facebook_id or id field (Facebook listing ID)' },
        { status: 400 }
      );
    }

    if (!sourceUrl) {
      return NextResponse.json(
        { error: 'JSON must contain source_url or url field' },
        { status: 400 }
      );
    }

    const startTime = Date.now();
    const supabase = await createClient();

    // Check for duplicate
    const { data: existing } = await supabase
      .from('facebook_rentals_metadata')
      .select('id, facebook_id, transformation_status, rental_id')
      .eq('facebook_id', facebookId)
      .single();

    if (existing) {
      return NextResponse.json({
        message: 'Listing already imported',
        metadataId: existing.id,
        facebookId: existing.facebook_id,
        status: existing.transformation_status,
        rentalId: existing.rental_id,
        alreadyExists: true,
      });
    }

    // Upload raw JSON to Storage with date-based partitioning
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const storagePath = `${year}/${month}/${facebookId}.json`;

    // Normalize to FacebookRentalRaw structure
    const rawJson: FacebookRentalRaw = isNewFormat
      ? jsonData as FacebookRentalRaw
      : {
          facebook_id: facebookId,
          source_url: sourceUrl,
          extracted_date: extractedDate || now.toISOString(),
          scraper_version: scraperVersion,
          raw_data: {
            extractedDate: extractedDate || now.toISOString(),
            id: facebookId,
            url: sourceUrl,
            title: rawDataContent.title,
            price: rawDataContent.price,
            address: rawDataContent.address || '',
            buildingDetails: rawDataContent.buildingDetails || [],
            unitDetails: rawDataContent.unitDetails || [],
            rentalLocation: rawDataContent.rentalLocation || '',
            description: rawDataContent.description || '',
            sellerInfo: rawDataContent.sellerInfo || { name: '', profileUrl: '' },
            media: rawDataContent.media || { images: [], videos: [] },
          },
        };

    const rawJsonStr = JSON.stringify(rawJson, null, 2);

    // Use service role client for storage operations (bypasses RLS)
    const supabaseServiceRole = createServiceRoleClient();
    const { error: uploadError } = await supabaseServiceRole.storage
      .from('facebook-raw-rentals')
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
    const titlePreview = rawJson.raw_data.title?.substring(0, 100) || null;
    const pricePreview = rawJson.raw_data.price;
    const addressPreview = rawJson.raw_data.address;

    // Download images and videos to storage using facebook_id as identifier
    let imageStoragePaths: string[] = [];
    let videoStoragePaths: string[] = [];
    const imageUrls = rawJson.raw_data.media.images || [];
    const videoUrls = rawJson.raw_data.media.videos || [];

    if (imageUrls.length > 0) {
      try {
        const imageResult = await processMediaArray(
          imageUrls,
          facebookId, // Use facebook_id as identifier
          'image',
          'facebook' // Storage path: rentals/facebook/{facebook_id}/image-{index}.jpg
        );
        imageStoragePaths = imageResult.storagePaths;
      } catch (imageError) {
        console.error('Image download error:', imageError);
        // Continue even if images fail - we can retry later
      }
    }

    if (videoUrls.length > 0) {
      try {
        const videoResult = await processMediaArray(
          videoUrls,
          facebookId,
          'video',
          'facebook' // Storage path: rentals/facebook/{facebook_id}/video-{index}.mp4
        );
        videoStoragePaths = videoResult.storagePaths;
      } catch (videoError) {
        console.error('Video download error:', videoError);
        // Continue even if videos fail
      }
    }

    // Insert metadata into table
    const { data: metadata, error: metadataError } = await supabase
      .from('facebook_rentals_metadata')
      .insert({
        facebook_id: facebookId,
        source_url: sourceUrl,
        storage_path: storagePath,
        raw_data_size_bytes: new Blob([rawJsonStr]).size,
        scrape_status: 'success',
        scrape_duration_ms: Date.now() - startTime,
        title_preview: titlePreview,
        price_preview: pricePreview,
        address_preview: addressPreview,
        images: imageStoragePaths,
        videos: videoStoragePaths,
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
      facebookId: metadata.facebook_id,
      storagePath: metadata.storage_path,
      message: 'JSON imported successfully. Ready for transformation.',
      preview: {
        title: metadata.title_preview,
        price: metadata.price_preview,
        address: metadata.address_preview,
      },
      imageCount: imageStoragePaths.length,
      videoCount: videoStoragePaths.length,
    });
  } catch (error) {
    console.error('Unexpected error in scrape-json endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to import JSON data' },
      { status: 500 }
      );
  }
}
