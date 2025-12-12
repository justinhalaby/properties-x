import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { geocodeAddress } from "@/lib/geocoding/google";

export async function POST(request: Request) {
  try {
    const { id_uev } = await request.json();

    if (!id_uev) {
      return NextResponse.json(
        { error: "id_uev is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Fetch evaluation
    const { data: evaluation, error: fetchError } = await supabase
      .from("property_evaluations")
      .select("id_uev, full_address, latitude, longitude")
      .eq("id_uev", id_uev)
      .single();

    if (fetchError || !evaluation) {
      return NextResponse.json(
        { error: "Evaluation not found" },
        { status: 404 }
      );
    }

    // Skip if already geocoded
    if (evaluation.latitude && evaluation.longitude) {
      return NextResponse.json({
        data: {
          latitude: evaluation.latitude,
          longitude: evaluation.longitude,
          cached: true,
        },
      });
    }

    // Geocode the address
    const result = await geocodeAddress(evaluation.full_address);

    if (!result) {
      return NextResponse.json(
        { error: "Failed to geocode address" },
        { status: 500 }
      );
    }

    // Store coordinates in database
    const { error: updateError } = await supabase
      .from("property_evaluations")
      .update({
        latitude: result.latitude,
        longitude: result.longitude,
        geocoded_at: new Date().toISOString(),
      })
      .eq("id_uev", id_uev);

    if (updateError) {
      console.error("Failed to update coordinates:", updateError);
      // Return coordinates anyway even if update fails
    }

    return NextResponse.json({
      data: {
        latitude: result.latitude,
        longitude: result.longitude,
        cached: false,
      },
    });

  } catch (error) {
    console.error("Geocoding error:", error);
    return NextResponse.json(
      { error: "Failed to geocode evaluation" },
      { status: 500 }
    );
  }
}
