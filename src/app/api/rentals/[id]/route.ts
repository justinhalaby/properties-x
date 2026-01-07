import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deleteRentalMedia } from "@/lib/storage/rental-media";
import type { UpdateRentalInput } from "@/types/rental";

// GET /api/rentals/[id] - Get a single rental
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("rentals")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Rental not found" },
          { status: 404 }
        );
      }
      console.error("Error fetching rental:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Failed to fetch rental" },
      { status: 500 }
    );
  }
}

// PUT /api/rentals/[id] - Update a rental
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const body: Partial<UpdateRentalInput> = await request.json();

    // Remove id from body if present
    const { id: _bodyId, ...updateData } = body as UpdateRentalInput;

    const { data, error } = await supabase
      .from("rentals")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Rental not found" },
          { status: 404 }
        );
      }
      console.error("Error updating rental:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Failed to update rental" },
      { status: 500 }
    );
  }
}

// DELETE /api/rentals/[id] - Delete a rental and associated media
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    // Get source_name from rental before deletion
    const { data: rental } = await supabase
      .from("rentals")
      .select("source_name")
      .eq("id", id)
      .single();

    // Determine source for storage cleanup
    const source = rental?.source_name === 'facebook_marketplace' ? 'facebook' : rental?.source_name || 'facebook';

    // Delete media from storage first (source-aware)
    await deleteRentalMedia(id, source);

    // Then delete from database
    const { error } = await supabase.from("rentals").delete().eq("id", id);

    if (error) {
      console.error("Error deleting rental:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: "Failed to delete rental" },
      { status: 500 }
    );
  }
}
