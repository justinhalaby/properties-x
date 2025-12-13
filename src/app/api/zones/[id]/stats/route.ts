import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/zones/[id]/stats - Refresh zone statistics
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Get zone
    const { data: zone, error: zoneError } = await supabase
      .from("scraping_zones")
      .select("*")
      .eq("id", id)
      .single();

    if (zoneError) {
      return NextResponse.json({ error: "Zone not found" }, { status: 404 });
    }

    // Count total properties
    const { count: totalProperties } = await supabase
      .from("property_evaluations")
      .select("*", { count: "exact", head: true })
      .gte("latitude", zone.min_lat)
      .lte("latitude", zone.max_lat)
      .gte("longitude", zone.min_lng)
      .lte("longitude", zone.max_lng)
      .not("latitude", "is", null)
      .not("longitude", "is", null);

    // Get matricules in zone
    const { data: properties } = await supabase
      .from("property_evaluations")
      .select("matricule83")
      .gte("latitude", zone.min_lat)
      .lte("latitude", zone.max_lat)
      .gte("longitude", zone.min_lng)
      .lte("longitude", zone.max_lng)
      .not("latitude", "is", null)
      .not("longitude", "is", null);

    const matricules = properties?.map((p) => p.matricule83).filter(Boolean) || [];

    let scrapedCount = 0;
    if (matricules.length > 0) {
      const { count } = await supabase
        .from("montreal_evaluation_details")
        .select("*", { count: "exact", head: true })
        .in("matricule", matricules);
      scrapedCount = count || 0;
    }

    // Update zone stats
    const { data: updatedZone, error: updateError } = await supabase
      .from("scraping_zones")
      .update({
        total_properties: totalProperties || 0,
        scraped_count: scrapedCount,
      })
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      data: {
        total_properties: totalProperties || 0,
        scraped_count: scrapedCount,
        unscraped_count: (totalProperties || 0) - scrapedCount,
        percentage_complete: totalProperties
          ? (scrapedCount / totalProperties) * 100
          : 0,
      },
      zone: updatedZone,
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Failed to fetch zone statistics" },
      { status: 500 }
    );
  }
}
