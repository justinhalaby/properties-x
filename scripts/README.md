# Property Evaluation Geocoding Scripts

This directory contains scripts for batch geocoding property evaluations.

## Batch Geocoding Script

### Overview

The `geocode-evaluations.ts` script geocodes all property evaluations in the database that don't have coordinates yet. It uses the OpenStreetMap Nominatim API and respects the rate limit of 1 request per second.

### Prerequisites

1. Apply the database migrations:
   - `005_add_update_policy_evaluations.sql` - Adds UPDATE policy for RLS
   - `006_add_show_on_map_column.sql` - Adds show_on_map boolean column

2. Make sure your `.env.local` file has:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

### Usage

```bash
# Geocode first 100 evaluations (test run)
npx tsx scripts/geocode-evaluations.ts --limit=100

# Dry run - see what would happen without making changes
npx tsx scripts/geocode-evaluations.ts --limit=10 --dry-run

# Geocode all evaluations without coordinates
npx tsx scripts/geocode-evaluations.ts --continue

# Geocode specific batch (use limit to control)
npx tsx scripts/geocode-evaluations.ts --limit=1000
```

### Options

- `--limit=N` - Only geocode N evaluations (default: 1000)
- `--dry-run` - Don't actually update the database, just show what would happen
- `--continue` - Skip evaluations that already have coordinates

### Rate Limiting

The script automatically waits 1.1 seconds between each geocoding request to respect Nominatim's rate limit of 1 request per second. This means:

- 100 evaluations = ~2 minutes
- 1,000 evaluations = ~20 minutes
- 10,000 evaluations = ~3 hours
- 65,000 evaluations (full dataset) = ~18 hours

### Recommended Workflow

1. **Test with a small batch first:**
   ```bash
   npx tsx scripts/geocode-evaluations.ts --limit=10 --dry-run
   npx tsx scripts/geocode-evaluations.ts --limit=10
   ```

2. **Run in batches of 1000:**
   ```bash
   npx tsx scripts/geocode-evaluations.ts --limit=1000 --continue
   ```

3. **Monitor progress and repeat:**
   - The script shows progress and success/fail counts
   - Run multiple times with `--continue` to gradually geocode all evaluations
   - Can be safely interrupted (Ctrl+C) and resumed

4. **After geocoding, manually select which evaluations to show on the map:**
   - Go to `/buildings` page
   - For evaluations with coordinates, you'll see a "Show on Map" button
   - Click to toggle `show_on_map = true`
   - Only evaluations with `show_on_map = true` appear on `/map` page

### Example Output

```
🌍 Property Evaluations Batch Geocoder
=====================================

📊 Fetching evaluations to geocode...
   Found 1000 evaluations to geocode

🚀 Starting geocoding...

[1/1000] 🔍 Geocoding: 215-217 rue de la Commune Ouest, Montréal, QC
[1/1000] ✅ Success: lat=45.496185, lon=-73.553052
[2/1000] 🔍 Geocoding: 425 avenue Viger Ouest, Montréal, QC
[2/1000] ✅ Success: lat=45.509123, lon=-73.562456
...

📈 Geocoding Summary
===================
✅ Successful: 987
❌ Failed:     13
📊 Total:      1000

✨ Successfully geocoded 987 evaluations!

✅ Done!
```

### Troubleshooting

**Rate limit errors:**
- The script already includes delays, but if you get rate limit errors, Nominatim may be under heavy load
- Wait a few minutes and try again with `--continue`

**Many failed geocodes:**
- Some addresses may not be geocodable (e.g., missing street names, invalid addresses)
- Check the console output to see which addresses failed
- Failed addresses are left without coordinates

**Database update errors:**
- Make sure you've applied migration `005_add_update_policy_evaluations.sql`
- Check that your Supabase credentials are correct

### Database Schema

The script updates these columns:
- `latitude` (DECIMAL) - Latitude coordinate
- `longitude` (DECIMAL) - Longitude coordinate
- `geocoded_at` (TIMESTAMP) - When the geocoding was performed
- `show_on_map` (BOOLEAN) - Whether to display on map (set manually via UI)

### Map Display

After geocoding:
1. Coordinates are stored but `show_on_map` defaults to `false`
2. Go to `/buildings` page to see all evaluations
3. Evaluations with coordinates show a "Show on Map" button
4. Click to toggle visibility on the map
5. Only evaluations with `show_on_map = true` appear on `/map` page
