import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST /api/zones/[id]/scrape - Trigger scraping for a zone
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const body = await request.json();

    const { limit } = body;

    if (!limit || limit < 1) {
      return NextResponse.json(
        { error: "Invalid limit parameter (must be >= 1)" },
        { status: 400 }
      );
    }

    // Get zone
    const { data: zone, error: zoneError } = await supabase
      .from("scraping_zones")
      .select("*")
      .eq("id", id)
      .single();

    if (zoneError) {
      return NextResponse.json({ error: "Zone not found" }, { status: 404 });
    }

    // Get unscraped properties
    const { data: properties } = await supabase
      .from("property_evaluations")
      .select("matricule83, clean_address, nombre_logement")
      .gte("latitude", zone.min_lat)
      .lte("latitude", zone.max_lat)
      .gte("longitude", zone.min_lng)
      .lte("longitude", zone.max_lng)
      .not("latitude", "is", null)
      .not("longitude", "is", null);

    if (!properties || properties.length === 0) {
      return NextResponse.json(
        { error: "No properties found in zone" },
        { status: 404 }
      );
    }

    const matricules = properties.map((p) => p.matricule83).filter(Boolean);

    // Filter out already scraped
    const { data: scraped } = await supabase
      .from("montreal_evaluation_details")
      .select("matricule")
      .in("matricule", matricules);

    const scrapedSet = new Set(scraped?.map((s) => s.matricule) || []);
    const unscraped = properties.filter(
      (p) => !scrapedSet.has(p.matricule83)
    );

    if (unscraped.length === 0) {
      return NextResponse.json(
        { message: "All properties in zone already scraped", already_complete: true },
        { status: 200 }
      );
    }

    // Create scraping job
    const { data: job, error: jobError } = await supabase
      .from("zone_scraping_jobs")
      .insert({
        zone_id: id,
        requested_limit: limit,
        total_to_scrape: Math.min(limit, unscraped.length),
        status: "pending",
      })
      .select()
      .single();

    if (jobError) {
      return NextResponse.json({ error: jobError.message }, { status: 500 });
    }

    // Return job info - actual scraping will be done by the script
    return NextResponse.json({
      message: "Scraping job created. Run the scraping script to start.",
      job,
      unscraped_count: unscraped.length,
      to_scrape: Math.min(limit, unscraped.length),
      command: `npm run scrape:zone -- --job-id=${job.id}`,
    }, { status: 201 });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Failed to trigger scraping" },
      { status: 500 }
    );
  }
}
