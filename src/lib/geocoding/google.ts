export interface GeocodingResult {
  latitude: number;
  longitude: number;
  displayName: string;
}

const GOOGLE_GEOCODING_BASE = "https://maps.googleapis.com/maps/api/geocode/json";

export async function geocodeAddress(
  address: string,
  city: string = "Montreal",
  postalCode?: string
): Promise<GeocodingResult | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    console.error("Missing GOOGLE_MAPS_API_KEY environment variable");
    return null;
  }

  const fullAddress = [address, city, postalCode, "Quebec", "Canada"]
    .filter(Boolean)
    .join(", ");

  const params = new URLSearchParams({
    address: fullAddress,
    key: apiKey,
    region: "ca",
  });

  try {
    const response = await fetch(`${GOOGLE_GEOCODING_BASE}?${params}`);

    if (!response.ok) {
      throw new Error(`Geocoding failed: ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== "OK" || !data.results || data.results.length === 0) {
      console.log(`   ⚠️  No results for: ${fullAddress} (Status: ${data.status})`);
      return null;
    }

    const result = data.results[0];
    const location = result.geometry.location;

    return {
      latitude: location.lat,
      longitude: location.lng,
      displayName: result.formatted_address,
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
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    console.error("Missing GOOGLE_MAPS_API_KEY environment variable");
    return null;
  }

  const params = new URLSearchParams({
    latlng: `${latitude},${longitude}`,
    key: apiKey,
  });

  try {
    const response = await fetch(
      `${GOOGLE_GEOCODING_BASE}?${params}`
    );

    if (!response.ok) {
      throw new Error(`Reverse geocoding failed: ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== "OK" || !data.results || data.results.length === 0) {
      return null;
    }

    return data.results[0].formatted_address;
  } catch (error) {
    console.error("Reverse geocoding error:", error);
    return null;
  }
}
