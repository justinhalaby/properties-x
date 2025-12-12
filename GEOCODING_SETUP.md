# Geocoding Setup - Google Maps API

## Overview

The application now uses **Google Maps Geocoding API** for converting addresses to coordinates. This provides better accuracy and faster processing compared to OpenStreetMap Nominatim.

## Getting Your Google Maps API Key

1. **Go to Google Cloud Console:**
   https://console.cloud.google.com/

2. **Create a new project** (or select an existing one)

3. **Enable the Geocoding API:**
   - Go to: https://console.cloud.google.com/apis/library
   - Search for "Geocoding API"
   - Click "Enable"

4. **Create API credentials:**
   - Go to: https://console.cloud.google.com/apis/credentials
   - Click "Create Credentials" → "API Key"
   - Copy your API key

5. **Restrict your API key (recommended):**
   - Click on your API key to edit it
   - Under "API restrictions", select "Restrict key"
   - Choose "Geocoding API" from the list
   - Save

## Setup

Add your Google Maps API key to `.env.local`:

```bash
GOOGLE_MAPS_API_KEY=your_api_key_here
```

## Pricing

Google Maps Geocoding API pricing (as of 2024):
- **$5 per 1,000 requests** after the free tier
- **$200 monthly credit** (covers ~40,000 requests free)
- First 40,000 requests per month are effectively free

For Montreal's ~65,000 property evaluations:
- With 10+ units filter: ~3,000-5,000 buildings
- Cost: **FREE** (well within the $200 credit)
- Without filter (all buildings): ~65,000 requests
- Cost: ~$125 after free credit

## Rate Limits

The script is configured to make **10 requests per second** to stay well under Google's limits:
- **Google allows:** 50+ requests/second
- **Script uses:** 10 requests/second (conservative)
- **Benefits:** Much faster than Nominatim (1 req/sec)

## Performance Comparison

### Nominatim (OpenStreetMap)
- ❌ Rate limit: 1 request/second
- ❌ Time for 1,000 buildings: ~25 minutes
- ❌ Lower accuracy for some addresses
- ✅ Free

### Google Maps API
- ✅ Rate limit: 50+ requests/second
- ✅ Time for 1,000 buildings: ~2 minutes
- ✅ Higher accuracy
- ✅ Better parsing of range addresses
- ✅ Effectively free with monthly credit

## Usage

### Geocode buildings with the script:

```bash
# Test with 10 buildings
npx tsx scripts/geocode-evaluations.ts --limit=10

# Geocode 1,000 buildings (takes ~2 minutes)
npx tsx scripts/geocode-evaluations.ts --limit=1000 --continue

# Geocode all buildings with 10+ units
npx tsx scripts/geocode-evaluations.ts --continue
```

### Through the API:

The geocoding API endpoint automatically uses Google:

```bash
POST /api/property-evaluations/geocode
{
  "id_uev": 1000002
}
```

## Files Modified

1. **`src/lib/geocoding/google.ts`** (NEW) - Google Maps API integration
2. **`scripts/geocode-evaluations.ts`** - Updated to use Google API
3. **`src/app/api/property-evaluations/geocode/route.ts`** - Updated to use Google API

## Monitoring Usage

Track your API usage in Google Cloud Console:
https://console.cloud.google.com/apis/dashboard

You can see:
- Requests per day
- Quota usage
- Estimated costs
- Error rates

## Troubleshooting

### "Missing GOOGLE_MAPS_API_KEY"
- Make sure you added it to `.env.local`
- Restart your dev server after adding the key

### "REQUEST_DENIED" error
- Check that Geocoding API is enabled in your project
- Verify API key restrictions aren't too strict
- Make sure billing is enabled on your Google Cloud account

### "OVER_QUERY_LIMIT"
- You've exceeded the rate limit
- Wait a few seconds and try again
- The script automatically handles rate limiting

### High costs
- Check your Google Cloud Console billing
- Review API usage dashboard
- Consider adding request limits in Google Cloud Console
- Use filters to reduce the number of buildings to geocode

## Reverting to Nominatim

If you need to switch back to the free OpenStreetMap Nominatim API:

1. Edit `scripts/geocode-evaluations.ts`:
   ```typescript
   import { geocodeAddress } from "../src/lib/geocoding/nominatim";
   ```

2. Edit `src/app/api/property-evaluations/geocode/route.ts`:
   ```typescript
   import { geocodeAddress } from "@/lib/geocoding/nominatim";
   ```

3. Update rate limit in the script:
   ```typescript
   const RATE_LIMIT_MS = 1500; // 1.5 seconds for Nominatim
   ```
