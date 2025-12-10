export interface GeocodingResult {
  latitude: number;
  longitude: number;
  displayName: string;
}

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org/search";

export async function geocodeAddress(
  address: string,
  city: string = "Montreal",
  postalCode?: string
): Promise<GeocodingResult | null> {
  const query = [address, city, postalCode, "Quebec", "Canada"]
    .filter(Boolean)
    .join(", ");

  const params = new URLSearchParams({
    q: query,
    format: "json",
    limit: "1",
    countrycodes: "ca",
  });

  try {
    const response = await fetch(`${NOMINATIM_BASE}?${params}`, {
      headers: {
        "User-Agent": "properties-x/1.0 (Montreal Real Estate Analysis)",
      },
    });

    if (!response.ok) {
      throw new Error(`Geocoding failed: ${response.status}`);
    }

    const results = await response.json();

    if (results.length === 0) {
      return null;
    }

    return {
      latitude: parseFloat(results[0].lat),
      longitude: parseFloat(results[0].lon),
      displayName: results[0].display_name,
    };
  } catch (error) {
    console.error("Geocoding error:", error);
    return null;
  }
}

export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<string | null> {
  const params = new URLSearchParams({
    lat: latitude.toString(),
    lon: longitude.toString(),
    format: "json",
  });

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?${params}`,
      {
        headers: {
          "User-Agent": "properties-x/1.0 (Montreal Real Estate Analysis)",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Reverse geocoding failed: ${response.status}`);
    }

    const result = await response.json();
    return result.display_name || null;
  } catch (error) {
    console.error("Reverse geocoding error:", error);
    return null;
  }
}
