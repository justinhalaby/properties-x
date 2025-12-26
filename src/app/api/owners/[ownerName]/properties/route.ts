import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/owners/[ownerName]/properties
 *
 * Retrieves all properties for a specific owner with coordinates
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ ownerName: string }> }
) {
  try {
    const { ownerName } = await params;
    const decodedOwnerName = decodeURIComponent(ownerName);

    const supabase = await createClient();

    // Get all properties for this owner from montreal_evaluation_details
    const { data: properties, error: propertiesError } = await supabase
      .from('montreal_evaluation_details')
      .select('*')
      .eq('owner_name', decodedOwnerName);

    if (propertiesError) {
      console.error('Failed to fetch properties:', propertiesError);
      throw propertiesError;
    }

    if (!properties || properties.length === 0) {
      return NextResponse.json({
        data: [],
        count: 0,
      });
    }

    // Get matricules
    const matricules = properties.map(p => p.matricule);

    // Get coordinates from property_evaluations table
    const { data: evaluations } = await supabase
      .from('property_evaluations')
      .select('matricule83, latitude, longitude')
      .in('matricule83', matricules);

    // Create a map of matricule to coordinates
    const coordsMap = new Map(
      (evaluations || []).map(e => [
        e.matricule83,
        { latitude: e.latitude, longitude: e.longitude }
      ])
    );

    // Add coordinates to properties
    const propertiesWithCoords = properties.map(property => {
      const coords = coordsMap.get(property.matricule);
      return {
        ...property,
        latitude: coords?.latitude || null,
        longitude: coords?.longitude || null,
      };
    });

    // Filter to only properties with coordinates
    const propertiesWithValidCoords = propertiesWithCoords.filter(
      p => p.latitude && p.longitude
    );

    return NextResponse.json({
      data: propertiesWithValidCoords,
      count: propertiesWithValidCoords.length,
      total: properties.length,
      owner_name: decodedOwnerName,
    });

  } catch (error) {
    console.error("Owner properties fetch error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

    return NextResponse.json(
      {
        error: "Failed to fetch owner properties",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
