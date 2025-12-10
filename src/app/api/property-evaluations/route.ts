import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/property-evaluations - List property evaluations with optional filters
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    // Pagination
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100); // Max 100
    const offset = (page - 1) * limit;

    // Build query
    let query = supabase
      .from("property_evaluations")
      .select("*", { count: "exact" });

    // Filter: Address search (full-text)
    const search = searchParams.get("search");
    if (search) {
      query = query.or(
        `clean_address.ilike.%${search}%,nom_rue.ilike.%${search}%`
      );
    }

    // Filter: Municipality
    const municipalite = searchParams.get("municipalite");
    if (municipalite) {
      query = query.eq("municipalite", municipalite);
    }

    // Filter: District
    const arrondissement = searchParams.get("arrondissement");
    if (arrondissement) {
      query = query.eq("no_arrond_ile_cum", arrondissement);
    }

    // Filter: Category
    const categorie = searchParams.get("categorie");
    if (categorie) {
      query = query.eq("categorie_uef", categorie);
    }

    // Filter: Usage code
    const usageCode = searchParams.get("usageCode");
    if (usageCode) {
      query = query.eq("code_utilisation", parseInt(usageCode));
    }

    // Filter: Construction year range
    const minYear = searchParams.get("minYear");
    const maxYear = searchParams.get("maxYear");
    if (minYear) {
      query = query
        .gte("annee_construction", parseInt(minYear))
        .neq("annee_construction", 9999);
    }
    if (maxYear) {
      query = query
        .lte("annee_construction", parseInt(maxYear))
        .neq("annee_construction", 9999);
    }

    // Filter: Number of units range
    const minLogements = searchParams.get("minLogements");
    const maxLogements = searchParams.get("maxLogements");
    if (minLogements) {
      query = query.gte("nombre_logement", parseInt(minLogements));
    }
    if (maxLogements) {
      query = query.lte("nombre_logement", parseInt(maxLogements));
    }

    // Filter: Floor count range
    const minEtages = searchParams.get("minEtages");
    const maxEtages = searchParams.get("maxEtages");
    if (minEtages) {
      query = query.gte("etage_hors_sol", parseInt(minEtages));
    }
    if (maxEtages) {
      query = query.lte("etage_hors_sol", parseInt(maxEtages));
    }

    // Filter: Land area range
    const minTerrainArea = searchParams.get("minTerrainArea");
    const maxTerrainArea = searchParams.get("maxTerrainArea");
    if (minTerrainArea) {
      query = query.gte("superficie_terrain", parseInt(minTerrainArea));
    }
    if (maxTerrainArea) {
      query = query.lte("superficie_terrain", parseInt(maxTerrainArea));
    }

    // Filter: Building area range
    const minBatimentArea = searchParams.get("minBatimentArea");
    const maxBatimentArea = searchParams.get("maxBatimentArea");
    if (minBatimentArea) {
      query = query.gte("superficie_batiment", parseInt(minBatimentArea));
    }
    if (maxBatimentArea) {
      query = query.lte("superficie_batiment", parseInt(maxBatimentArea));
    }

    // Execute query with pagination
    const { data, error, count } = await query
      .range(offset, offset + limit - 1)
      .order("id_uev", { ascending: true });

    if (error) {
      console.error("Error fetching property evaluations:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      data,
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Failed to fetch property evaluations" },
      { status: 500 }
    );
  }
}
