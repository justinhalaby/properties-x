# Map View Usage Guide

## Overview

The map page displays property evaluations dynamically based on filter criteria. By default, **no buildings are shown** until you apply filters.

## How It Works

### Default State
- Navigate to `/map` page
- Map is empty by default (no evaluations displayed)
- Empty state message: "Use filters to display buildings on the map"
- Click "Open Filters" button to get started

### Applying Filters

1. **Click the "Filters" button** in the top-left corner
2. **Set your criteria:**
   - **Search Address** - Filter by street name (e.g., "Saint-Laurent")
   - **Number of Units** - Min/max range (e.g., 5-50 units)
   - **Construction Year** - Min/max range (e.g., 1900-2024)
   - **Category** - Condominium or Régulier

3. **Click "Apply Filters"**
4. Map updates to show all evaluations matching your criteria

### Quick Filters

Use pre-configured filters for common scenarios:
- **5+ Units** - Buildings with 5 or more units
- **10+ Units** - Buildings with 10 or more units
- **20+ Units** - Buildings with 20 or more units
- **Built 2000+** - Recently constructed buildings
- **Pre-1950** - Historic buildings

Click a quick filter button, then click "Apply Filters"

## Filter Logic

All filters use **AND** logic:
- Evaluations must have coordinates (geocoded)
- AND match ALL specified criteria

Example:
```
minUnits=10 + category=Condominium + minYear=2000
= Only condos with 10+ units built after 2000
```

## Example Queries

### Find Large Buildings
1. Set "Min Units" to 20
2. Click "Apply Filters"
3. **Result:** All buildings with 20+ units

### Find New Condos
1. Click "Built 2000+" quick filter
2. Select "Condominium" category
3. Click "Apply Filters"
4. **Result:** Condos built after 2000

### Find Buildings on Specific Street
1. Type "Saint-Laurent" in Search Address
2. Click "Apply Filters"
3. **Result:** Buildings on streets containing "Saint-Laurent"

### Find Mid-Size Pre-War Buildings
1. Set Min Units: 5, Max Units: 15
2. Set Max Year: 1945
3. Click "Apply Filters"
4. **Result:** Buildings with 5-15 units built before 1945

### Find All Buildings (No Filter)
1. Leave all filter fields empty
2. Click "Apply Filters"
3. **Result:** All geocoded evaluations (up to 10,000 limit)

## Map Markers

### Marker Colors
- **Blue markers** - Regular properties (show price)
- **Green markers** - Property evaluations (show unit count)

### Marker Popups
Click any marker to see:
- **For Properties:** Title, address, price, beds, baths, sqft
- **For Evaluations:** Address, units, category, year, floors, land area
- Link to view full details

### Map Legend
Top-right corner shows marker type explanations

## Map Stats Bar

Below the header, shows:
- Total locations displayed
- Count of properties vs evaluations
- Updates dynamically with filters

## Clearing Filters

- Click "Clear" in filter panel to reset all fields
- Or click "Clear Filters" in empty state when no results found

## Performance Notes

- Results limited to 10,000 evaluations max
- Only evaluations with coordinates (geocoded) are shown
- Filters applied server-side for fast performance
- Map auto-zooms to fit all displayed markers

## Prerequisites

### Geocoding Required

Evaluations must be geocoded before they can appear on the map. To geocode evaluations:

```bash
# Geocode first 100 as a test
npx tsx scripts/geocode-evaluations.ts --limit=100

# Then geocode in batches
npx tsx scripts/geocode-evaluations.ts --limit=1000 --continue
```

See `scripts/README.md` for full geocoding documentation.

### Database Setup

Make sure these migrations are applied:
1. `004_add_coordinates_to_evaluations.sql` - Adds lat/long columns
2. `005_add_update_policy_evaluations.sql` - Adds RLS policy for updates

## Workflow Summary

1. **One-time setup:** Geocode evaluations using the batch script
2. **Daily use:**
   - Go to `/map` page
   - Apply filters to see buildings
   - Explore results on map
   - Clear filters and try different criteria

No need to manually mark buildings for display - just use filters to control what you see!
