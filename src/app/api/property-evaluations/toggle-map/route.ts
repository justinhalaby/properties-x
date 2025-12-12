import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const { id_uev, show_on_map } = await request.json();

    if (!id_uev || typeof show_on_map !== "boolean") {
      return NextResponse.json(
        { error: "id_uev and show_on_map (boolean) are required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Update show_on_map field
    const { error: updateError } = await supabase
      .from("property_evaluations")
      .update({
        show_on_map,
      })
      .eq("id_uev", id_uev);

    if (updateError) {
      console.error("Failed to toggle map visibility:", updateError);
      return NextResponse.json(
        { error: "Failed to update map visibility" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      show_on_map,
    });

  } catch (error) {
    console.error("Toggle map error:", error);
    return NextResponse.json(
      { error: "Failed to toggle map visibility" },
      { status: 500 }
    );
  }
}
