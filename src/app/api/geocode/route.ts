import { NextResponse } from "next/server";
import { geocodeAddress } from "@/lib/geocoding/nominatim";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { address, city, postalCode } = body;

    if (!address) {
      return NextResponse.json(
        { error: "Address is required" },
        { status: 400 }
      );
    }

    const result = await geocodeAddress(address, city, postalCode);

    if (!result) {
      return NextResponse.json(
        { error: "Could not geocode address" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("Geocode error:", error);
    return NextResponse.json(
      { error: "Failed to geocode address" },
      { status: 500 }
    );
  }
}
