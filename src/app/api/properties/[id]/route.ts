import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { UpdatePropertyInput } from "@/types/property";

// GET /api/properties/[id] - Get a single property
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("properties")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Property not found" },
          { status: 404 }
        );
      }
      console.error("Error fetching property:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Failed to fetch property" },
      { status: 500 }
    );
  }
}

// PUT /api/properties/[id] - Update a property
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const body: Partial<UpdatePropertyInput> = await request.json();

    // Remove id from body if present (shouldn't update id)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _bodyId, ...updateData } = body as UpdatePropertyInput;

    const { data, error } = await supabase
      .from("properties")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Property not found" },
          { status: 404 }
        );
      }
      console.error("Error updating property:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Failed to update property" },
      { status: 500 }
    );
  }
}

// DELETE /api/properties/[id] - Delete a property
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { error } = await supabase.from("properties").delete().eq("id", id);

    if (error) {
      console.error("Error deleting property:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Failed to delete property" },
      { status: 500 }
    );
  }
}
