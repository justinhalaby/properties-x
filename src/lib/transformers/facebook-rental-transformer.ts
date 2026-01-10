import { FacebookRentalCurated } from '@/types/facebook-rental-curated';
import { CreateRentalInput } from '@/types/rental';

/**
 * Transform FacebookRentalCurated → CreateRentalInput
 * Stage 2 of the two-stage pipeline
 */
export function transformCuratedToRental(
  curated: FacebookRentalCurated
): {
  rentalInput: CreateRentalInput;
  warnings: string[];
  errors: string[];
} {
  const warnings: string[] = [];
  const errors: string[] = [];

  const rentalInput: CreateRentalInput = {
    source_url: curated.source_url,
    source_name: 'facebook_marketplace',
    facebook_id: curated.facebook_id,
    title: curated.title,
    address: curated.address || null,
    city: curated.city || null,
    postal_code: curated.postal_code || null,
    rental_location: curated.rental_location || null,
    monthly_rent: curated.price || null,
    price_display: curated.price_display || null,
    bedrooms: curated.bedrooms || null,
    bathrooms: curated.bathrooms || null,
    square_footage: curated.square_footage || null,
    unit_type: curated.unit_type || null,
    pet_policy: curated.pet_policy,
    amenities: curated.amenities,
    unit_details_raw: curated.unit_details_raw,
    building_details: curated.building_details,
    description: curated.description || null,
    seller_name: curated.seller_name || null,
    seller_profile_url: curated.seller_profile_url || null,
    // Images/videos will be downloaded and paths set by transform API
    images: [],
    videos: [],
    // Geocoding will be done by transform API
    latitude: null,
    longitude: null,
    geocoded_at: null,
  };

  return { rentalInput, warnings, errors };
}
