import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseFacebookRental, validateFacebookRentalJson } from "@/lib/parsers/facebook-rental-parser";
import { geocodeAddress } from "@/lib/geocoding/nominatim";
import { processMediaArray } from "@/lib/storage/rental-media";
import type { CreateRentalInput, FacebookRental } from "@/types/rental";

// GET /api/rentals - List with filters
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    let query = supabase.from("rentals").select("*").order("created_at", { ascending: false });

    // Apply filters
    const city = searchParams.get("city");
    const minRent = searchParams.get("minRent");
    const maxRent = searchParams.get("maxRent");
    const bedrooms = searchParams.get("bedrooms");
    const petFriendly = searchParams.get("petFriendly");
    const search = searchParams.get("search");

    if (city) {
      query = query.ilike("city", `%${city}%`);
    }
    if (minRent) {
      query = query.gte("monthly_rent", parseFloat(minRent));
    }
    if (maxRent) {
      query = query.lte("monthly_rent", parseFloat(maxRent));
    }
    if (bedrooms) {
      query = query.gte("bedrooms", parseInt(bedrooms));
    }
    if (petFriendly === "true") {
      // Filter for rentals with cat_friendly or dog_friendly in pet_policy
      query = query.or("pet_policy.cs.{cat_friendly},pet_policy.cs.{dog_friendly}");
    }
    if (search) {
      query = query.or(
        `title.ilike.%${search}%,address.ilike.%${search}%,description.ilike.%${search}%`
      );
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching rentals:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Failed to fetch rentals" },
      { status: 500 }
    );
  }
}

// POST /api/rentals - Create rental (accepts Facebook JSON or manual input)
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const forceUpdate = body.forceUpdate === true; // Check if user confirmed update

    let rentalInput: CreateRentalInput;
    let warnings: string[] = [];
    let fbImages: string[] = [];
    let fbVideos: string[] = [];
    let existingRentalId: string | null = null;
    let shouldGeocode = true;

    // Check if it's Facebook JSON format
    if (validateFacebookRentalJson(body)) {
      const parseResult = parseFacebookRental(body as FacebookRental);

      if (parseResult.errors.length > 0) {
        return NextResponse.json(
          { error: "Invalid rental data", details: parseResult.errors },
          { status: 400 }
        );
      }

      rentalInput = parseResult.input;
      warnings = parseResult.warnings;

      // Store Facebook URLs temporarily (will process after rental creation)
      fbImages = (body as FacebookRental).media?.images || [];
      fbVideos = (body as FacebookRental).media?.videos || [];

      // Check if rental with this facebook_id already exists
      if (rentalInput.facebook_id) {
        const { data: existingRental } = await supabase
          .from("rentals")
          .select("id, title, address, latitude, longitude")
          .eq("facebook_id", rentalInput.facebook_id)
          .single();

        if (existingRental) {
          if (!forceUpdate) {
            // Return conflict with existing rental info
            return NextResponse.json(
              {
                error: "duplicate",
                message: "This rental has already been imported",
                existingRental: {
                  id: existingRental.id,
                  title: existingRental.title,
                  address: existingRental.address,
                },
              },
              { status: 409 }
            );
          }

          // User confirmed update - use existing ID and preserve geocoding
          existingRentalId = existingRental.id;
          shouldGeocode = false; // Don't re-geocode on update

          // Preserve existing coordinates
          if (existingRental.latitude && existingRental.longitude) {
            rentalInput.latitude = existingRental.latitude;
            rentalInput.longitude = existingRental.longitude;
          }
        }
      }

      // Auto-geocode if address exists and no existing coordinates
      if (shouldGeocode && rentalInput.address && !rentalInput.latitude) {
        try {
          const geoResult = await geocodeAddress(
            rentalInput.address,
            rentalInput.city,
            rentalInput.postal_code
          );

          if (geoResult) {
            rentalInput.latitude = geoResult.latitude;
            rentalInput.longitude = geoResult.longitude;
          } else {
            warnings.push("Could not geocode address");
          }
        } catch (geoError) {
          console.error("Geocoding error:", geoError);
          warnings.push("Geocoding failed");
        }
      }
    } else {
      // Direct CreateRentalInput format
      rentalInput = body as CreateRentalInput;

      if (!rentalInput.title) {
        return NextResponse.json(
          { error: "Title is required" },
          { status: 400 }
        );
      }
    }

    // Prepare rental data
    const rentalData = {
      source_url: rentalInput.source_url ?? null,
      source_name: rentalInput.source_name ?? 'manual',
      facebook_id: rentalInput.facebook_id ?? null,
      extracted_date: rentalInput.extracted_date ?? null,
      title: rentalInput.title,
      address: rentalInput.address ?? null,
      city: rentalInput.city ?? null,
      postal_code: rentalInput.postal_code ?? null,
      rental_location: rentalInput.rental_location ?? null,
      monthly_rent: rentalInput.monthly_rent ?? null,
      bedrooms: rentalInput.bedrooms ?? null,
      bathrooms: rentalInput.bathrooms ?? null,
      unit_type: rentalInput.unit_type ?? null,
      pet_policy: rentalInput.pet_policy ?? [],
      amenities: rentalInput.amenities ?? [],
      unit_details_raw: rentalInput.unit_details_raw ?? [],
      building_details: rentalInput.building_details ?? [],
      description: rentalInput.description ?? null,
      seller_name: rentalInput.seller_name ?? null,
      seller_profile_url: rentalInput.seller_profile_url ?? null,
      images: [], // Will be updated after media processing
      videos: [], // Will be updated after media processing
      latitude: rentalInput.latitude ?? null,
      longitude: rentalInput.longitude ?? null,
      geocoded_at: rentalInput.latitude ? new Date().toISOString() : null,
      notes: rentalInput.notes ?? null,
    };

    let rental;
    let rentalError;

    if (existingRentalId) {
      // Update existing rental
      const { data, error } = await supabase
        .from("rentals")
        .update(rentalData)
        .eq("id", existingRentalId)
        .select()
        .single();

      rental = data;
      rentalError = error;
      warnings.push("Updated existing rental");
    } else {
      // Create new rental
      const { data, error } = await supabase
        .from("rentals")
        .insert(rentalData)
        .select()
        .single();

      rental = data;
      rentalError = error;
    }

    if (rentalError || !rental) {
      console.error("Error saving rental:", rentalError);
      return NextResponse.json(
        { error: rentalError?.message || "Failed to save rental" },
        { status: 500 }
      );
    }

    // Download and upload media to Supabase Storage
    let imageStoragePaths: string[] = [];
    let videoStoragePaths: string[] = [];

    if (fbImages.length > 0) {
      const imageResult = await processMediaArray(fbImages, rental.id, 'image', 'facebook');
      imageStoragePaths = imageResult.storagePaths;
      warnings.push(...imageResult.warnings);
    }

    if (fbVideos.length > 0) {
      const videoResult = await processMediaArray(fbVideos, rental.id, 'video', 'facebook');
      videoStoragePaths = videoResult.storagePaths;
      warnings.push(...videoResult.warnings);
    }

    // Update rental with storage paths
    const { data: updatedRental } = await supabase
      .from("rentals")
      .update({
        images: imageStoragePaths,
        videos: videoStoragePaths,
      })
      .eq("id", rental.id)
      .select()
      .single();

    return NextResponse.json(
      {
        data: updatedRental || rental,
        warnings: warnings.length > 0 ? warnings : undefined,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Failed to create rental" },
      { status: 500 }
    );
  }
}
