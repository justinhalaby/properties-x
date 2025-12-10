import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/property-evaluations/[id] - Get a single property evaluation
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("property_evaluations")
      .select("*")
      .eq("id_uev", parseInt(id))
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Property evaluation not found" },
          { status: 404 }
        );
      }
      console.error("Error fetching property evaluation:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Failed to fetch property evaluation" },
      { status: 500 }
    );
  }
}
