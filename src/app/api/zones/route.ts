import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { ScrapingZoneInsert } from "@/types/scraping-zone";

// GET /api/zones - List all zones
export async function GET() {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("scraping_zones")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching zones:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Failed to fetch zones" },
      { status: 500 }
    );
  }
}

// POST /api/zones - Create new zone
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();

    const { name, description, min_lat, max_lat, min_lng, max_lng, target_limit } = body;

    // Validate required fields
    if (!name || min_lat == null || max_lat == null || min_lng == null || max_lng == null) {
      return NextResponse.json(
        { error: "Missing required fields: name, min_lat, max_lat, min_lng, max_lng" },
        { status: 400 }
      );
    }

    // Count properties within bounds
    const { count: totalProperties } = await supabase
      .from("property_evaluations")
      .select("*", { count: "exact", head: true })
      .gte("latitude", min_lat)
      .lte("latitude", max_lat)
      .gte("longitude", min_lng)
      .lte("longitude", max_lng)
      .not("latitude", "is", null)
      .not("longitude", "is", null);

    // Count already scraped properties
    const { data: evaluationsInZone } = await supabase
      .from("property_evaluations")
      .select("matricule83")
      .gte("latitude", min_lat)
      .lte("latitude", max_lat)
      .gte("longitude", min_lng)
      .lte("longitude", max_lng)
      .not("latitude", "is", null)
      .not("longitude", "is", null);

    const matricules = evaluationsInZone?.map((e) => e.matricule83).filter(Boolean) || [];

    let scrapedCount = 0;
    if (matricules.length > 0) {
      const { count } = await supabase
        .from("montreal_evaluation_details")
        .select("*", { count: "exact", head: true })
        .in("matricule", matricules);
      scrapedCount = count || 0;
    }

    // Insert zone
    const insertData: ScrapingZoneInsert = {
      name,
      description: description || null,
      min_lat,
      max_lat,
      min_lng,
      max_lng,
      target_limit: target_limit || null,
      total_properties: totalProperties || 0,
      scraped_count: scrapedCount,
    };

    const { data: zone, error: insertError } = await supabase
      .from("scraping_zones")
      .insert(insertData)
      .select()
      .single();

    if (insertError) {
      console.error("Error creating zone:", insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ data: zone }, { status: 201 });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Failed to create zone" },
      { status: 500 }
    );
  }
}
