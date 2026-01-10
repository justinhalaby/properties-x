/**
 * Raw FacebookRental format from console scraper
 * This is the exact structure saved to facebook-raw-rentals bucket
 */
export interface FacebookRentalRaw {
  facebook_id: string;
  source_url: string;
  extracted_date: string; // ISO timestamp when script ran
  scraper_version: string; // "console-v2"

  raw_data: {
    extractedDate: string;
    id: string; // Same as facebook_id
    url: string;
    title: string;
    price: string; // "CA$2,175 / Month"
    address: string;
    buildingDetails: string[];
    unitDetails: string[];
    rentalLocation: string; // "Montréal, QC, H2S 2Z5"
    description: string;
    sellerInfo: {
      name: string;
      profileUrl: string;
    };
    media: {
      images: string[]; // CDN URLs
      videos: string[]; // CDN URLs
    };
  };
}
