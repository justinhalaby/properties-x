import { createClient } from "@/lib/supabase/server";

interface MediaDownloadResult {
  storagePath: string | null;
  error?: string;
}

/**
 * Downloads media from Facebook URL and uploads to Supabase Storage
 * @param url - Facebook media URL
 * @param rentalId - Rental UUID for folder organization
 * @param type - 'image' or 'video'
 * @param index - Index in the media array
 * @param source - Source identifier (e.g., 'facebook', 'kijiji')
 * @returns Storage path or null if failed
 */
export async function downloadAndUploadMedia(
  url: string,
  rentalId: string,
  type: 'image' | 'video',
  index: number,
  source: string = 'facebook'
): Promise<MediaDownloadResult> {
  try {
    // Download from Facebook
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; properties-x-bot/1.0)',
      },
    });

    if (!response.ok) {
      return { storagePath: null, error: `Failed to download: ${response.status}` };
    }

    // Get file extension from URL or content-type
    const contentType = response.headers.get('content-type') || '';
    const ext = getExtensionFromContentType(contentType) || 'jpg';

    // Convert to buffer
    const buffer = await response.arrayBuffer();
    const file = new Uint8Array(buffer);

    // Upload to Supabase Storage with source-based path
    const supabase = await createClient();
    const fileName = `${type}-${index}.${ext}`;
    const storagePath = `${source}/${rentalId}/${fileName}`; // e.g., "facebook/uuid/image-0.jpg"

    const { error: uploadError } = await supabase.storage
      .from('rentals')
      .upload(storagePath, file, {
        contentType: contentType || 'image/jpeg',
        upsert: false,
      });

    if (uploadError) {
      return { storagePath: null, error: `Upload failed: ${uploadError.message}` };
    }

    return { storagePath };
  } catch (error) {
    return {
      storagePath: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Downloads and uploads multiple media files
 * @param urls - Array of media URLs
 * @param rentalId - Rental UUID
 * @param type - 'image' or 'video'
 * @param source - Source identifier
 * @returns Array of storage paths and warnings
 */
export async function processMediaArray(
  urls: string[],
  rentalId: string,
  type: 'image' | 'video',
  source: string = 'facebook'
): Promise<{ storagePaths: string[]; warnings: string[] }> {
  const storagePaths: string[] = [];
  const warnings: string[] = [];

  for (let i = 0; i < urls.length; i++) {
    const result = await downloadAndUploadMedia(urls[i], rentalId, type, i, source);

    if (result.storagePath) {
      storagePaths.push(result.storagePath);
    } else {
      warnings.push(`${type} ${i + 1}: ${result.error}`);
    }
  }

  return { storagePaths, warnings };
}

/**
 * Get file extension from content-type header
 */
function getExtensionFromContentType(contentType: string): string | null {
  const typeMap: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/quicktime': 'mov',
    'video/webm': 'webm',
  };

  return typeMap[contentType.toLowerCase()] || null;
}

/**
 * Get public URL for a storage path
 */
export async function getPublicUrl(storagePath: string): Promise<string> {
  const supabase = await createClient();
  const { data } = supabase.storage.from('rentals').getPublicUrl(storagePath);
  return data.publicUrl;
}

/**
 * Delete all media for a rental
 * @param rentalId - Rental UUID
 * @param source - Source identifier (e.g., 'facebook')
 */
export async function deleteRentalMedia(rentalId: string, source: string = 'facebook'): Promise<void> {
  const supabase = await createClient();

  // List all files in the rental folder (source-specific)
  const { data: files } = await supabase.storage
    .from('rentals')
    .list(`${source}/${rentalId}`);

  if (!files || files.length === 0) return;

  // Delete all files (source-specific path)
  const filePaths = files.map((file) => `${source}/${rentalId}/${file.name}`);
  await supabase.storage.from('rentals').remove(filePaths);
}
