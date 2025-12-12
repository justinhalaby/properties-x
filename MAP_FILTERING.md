# Map Filtering System

## Overview

The map page now includes a comprehensive filtering system that allows you to dynamically select which property evaluations to display based on various criteria.

## Features

### Filter Criteria

1. **Search Address** - Filter by street name or address text
2. **Number of Units** - Min/max range for number of dwelling units
3. **Construction Year** - Min/max range for year built
4. **Category** - Filter by Condominium or Régulier

### Quick Filters

Pre-configured filters for common scenarios:
- **5+ Units** - Buildings with 5 or more units
- **10+ Units** - Buildings with 10 or more units
- **20+ Units** - Buildings with 20 or more units
- **Built 2000+** - Recently constructed buildings
- **Pre-1950** - Historic buildings

## How It Works

### Workflow

1. **Mark Evaluations for Map Display**
   - Go to `/buildings` page
   - For evaluations with coordinates, click "Show on Map" button
   - This sets `show_on_map = true` in the database

2. **Apply Filters on Map**
   - Go to `/map` page
   - Click the "Filters" button (top-left)
   - Set your filter criteria
   - Click "Apply Filters"
   - Only evaluations matching ALL criteria will be displayed

3. **Quick Filters**
   - Click any quick filter button to auto-populate the form
   - Then click "Apply Filters"

### Filter Logic

Filters work with **AND** logic:
- `show_on_map = true` (always applied)
- AND `units >= minUnits` (if specified)
- AND `units <= maxUnits` (if specified)
- AND `year >= minYear` (if specified)
- AND `year <= maxYear` (if specified)
- AND `category = selected` (if specified)
- AND `address LIKE %search%` (if specified)

## API Integration

The map page sends filter parameters to the API:

```typescript
GET /api/property-evaluations?showOnMap=true&minLogements=5&maxLogements=50&minYear=2000&categorie=Condominium
```

Supported parameters:
- `showOnMap=true` - Only show evaluations marked for display
- `minLogements=N` - Minimum number of units
- `maxLogements=N` - Maximum number of units
- `minYear=YYYY` - Minimum construction year
- `maxYear=YYYY` - Maximum construction year
- `categorie=TYPE` - Category filter (Condominium or Régulier)
- `search=TEXT` - Address search text

## UI/UX

### Filter Panel

- **Collapsed State**: Shows "Filters" button in top-left
- **Expanded State**: Shows filter form panel with all options
- **Position**: Fixed top-left, scrollable if needed
- **Actions**:
  - "Apply Filters" - Apply current filter values
  - "Clear" - Reset all filters to empty
  - "X" button - Close panel without applying changes

### Empty States

Two different empty state messages:

1. **No Filters Applied**: "No evaluations marked for map display"
   - Shows link to `/buildings` page to mark evaluations

2. **Filters Applied**: "No evaluations match your filters"
   - Shows "Clear Filters" button to reset

### Map Stats Bar

Shows count breakdown:
- Total locations on map
- Number of properties
- Number of evaluations

Updates dynamically based on applied filters.

## Example Use Cases

### Find Large Buildings

1. Open filters
2. Set "Min Units" to 20
3. Apply filters
4. Map shows only buildings with 20+ units

### Find New Condos

1. Open filters
2. Click "Built 2000+" quick filter
3. Select "Condominium" category
4. Apply filters
5. Map shows only condos built after 2000

### Find Buildings on Specific Street

1. Open filters
2. Type "Saint-Laurent" in Search Address
3. Apply filters
4. Map shows only evaluations on streets containing "Saint-Laurent"

### Find Mid-Size Pre-War Buildings

1. Open filters
2. Set Min Units: 5, Max Units: 15
3. Set Max Year: 1945
4. Apply filters
5. Map shows buildings with 5-15 units built before 1945

## Technical Implementation

### Files Modified

1. **`src/components/map/map-filters.tsx`** (NEW)
   - Filter panel component with form controls
   - Quick filter buttons
   - Apply/Clear actions

2. **`src/app/map/page.tsx`**
   - Added filter state management
   - Integrated MapFiltersPanel component
   - Dynamic query parameter building
   - Updated empty states

3. **`src/app/api/property-evaluations/route.ts`**
   - Already supports all filter parameters
   - Returns filtered results based on query params

### State Management

```typescript
const [filters, setFilters] = useState<MapFilters>({});
const [filtersOpen, setFiltersOpen] = useState(false);

// When filters change, re-fetch data
useEffect(() => {
  fetchData();
}, [filters]);
```

### Performance

- Filters are applied server-side via SQL queries
- Indexed columns ensure fast filtering
- Results limited to 10,000 evaluations max
- Only evaluations with `show_on_map = true` are queried

## Future Enhancements

Potential improvements:

1. **URL State** - Save filters in URL query params for sharing
2. **Filter Presets** - Save custom filter combinations
3. **More Filters** - Add floor count, land area, building area
4. **Range Sliders** - Visual range selection for units/year
5. **Map Clustering** - Group nearby markers when zoomed out
6. **Bulk Toggle** - Toggle multiple evaluations on/off from map
7. **Export** - Export filtered results to CSV
