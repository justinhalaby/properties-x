import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { CreatePropertyInput } from "@/types/property";

// GET /api/properties - List all properties with optional filters
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    let query = supabase
      .from("properties")
      .select("*")
      .order("created_at", { ascending: false });

    // Apply filters
    const city = searchParams.get("city");
    const minPrice = searchParams.get("minPrice");
    const maxPrice = searchParams.get("maxPrice");
    const bedrooms = searchParams.get("bedrooms");
    const propertyType = searchParams.get("propertyType");
    const search = searchParams.get("search");

    if (city) {
      query = query.ilike("city", `%${city}%`);
    }
    if (minPrice) {
      query = query.gte("price", parseFloat(minPrice));
    }
    if (maxPrice) {
      query = query.lte("price", parseFloat(maxPrice));
    }
    if (bedrooms) {
      query = query.gte("bedrooms", parseInt(bedrooms));
    }
    if (propertyType) {
      query = query.eq("property_type", propertyType);
    }
    if (search) {
      query = query.or(
        `title.ilike.%${search}%,address.ilike.%${search}%,description.ilike.%${search}%`
      );
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching properties:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Failed to fetch properties" },
      { status: 500 }
    );
  }
}

// POST /api/properties - Create a new property
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body: CreatePropertyInput = await request.json();

    if (!body.title) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("properties")
      .insert({
        source_url: body.source_url ?? null,
        source_name: body.source_name ?? null,
        title: body.title,
        address: body.address ?? null,
        city: body.city ?? null,
        postal_code: body.postal_code ?? null,
        price: body.price ?? null,
        bedrooms: body.bedrooms ?? null,
        bathrooms: body.bathrooms ?? null,
        sqft: body.sqft ?? null,
        lot_size: body.lot_size ?? null,
        year_built: body.year_built ?? null,
        property_type: body.property_type ?? null,
        mls_number: body.mls_number ?? null,
        description: body.description ?? null,
        features: body.features ?? [],
        images: body.images ?? [],
        latitude: body.latitude ?? null,
        longitude: body.longitude ?? null,
        notes: body.notes ?? null,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating property:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Failed to create property" },
      { status: 500 }
    );
  }
}
