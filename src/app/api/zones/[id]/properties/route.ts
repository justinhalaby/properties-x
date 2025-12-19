import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/zones/[id]/properties - Get properties within zone
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    // Get zone details
    const { data: zone, error: zoneError } = await supabase
      .from("scraping_zones")
      .select("*")
      .eq("id", id)
      .single();

    if (zoneError) {
      return NextResponse.json({ error: "Zone not found" }, { status: 404 });
    }

    // Query parameters
    const onlyUnscraped = searchParams.get("onlyUnscraped") === "true";
    const limit = parseInt(searchParams.get("limit") || "100");

    // Get properties within zone bounds with unit filters
    let query = supabase
      .from("property_evaluations")
      .select("*")
      .gte("latitude", zone.min_lat)
      .lte("latitude", zone.max_lat)
      .gte("longitude", zone.min_lng)
      .lte("longitude", zone.max_lng)
      .not("latitude", "is", null)
      .not("longitude", "is", null)
      .limit(limit);

    // Apply unit filters from zone configuration
    if (zone.min_units != null) {
      query = query.gte("nombre_logement", zone.min_units);
    }
    if (zone.max_units != null) {
      query = query.lte("nombre_logement", zone.max_units);
    }

    const { data: properties, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!properties || properties.length === 0) {
      return NextResponse.json({
        data: [],
        total: 0,
      });
    }

    // Get scraped status for all properties
    const matricules = properties.map((p) => p.matricule83).filter(Boolean);

    if (matricules.length === 0) {
      return NextResponse.json({
        data: properties.map((p) => ({ ...p, is_scraped: false })),
        total: properties.length,
      });
    }

    const { data: scraped } = await supabase
      .from("montreal_evaluation_details")
      .select("matricule")
      .in("matricule", matricules);

    const scrapedSet = new Set(scraped?.map((s) => s.matricule) || []);

    // Add is_scraped flag to all properties
    const propertiesWithStatus = properties.map((p) => ({
      ...p,
      is_scraped: scrapedSet.has(p.matricule83),
    }));

    // Filter if onlyUnscraped is requested
    const filteredProperties = onlyUnscraped
      ? propertiesWithStatus.filter((p) => !p.is_scraped)
      : propertiesWithStatus;

    return NextResponse.json({
      data: filteredProperties,
      total: filteredProperties.length,
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Failed to fetch zone properties" },
      { status: 500 }
    );
  }
}
