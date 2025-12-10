# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

properties-x is a Montreal real estate analysis platform built with Next.js 16, React 19, and Supabase. It allows users to:
- Add properties by URL (scraping from Centris, Realtor.ca, etc.)
- View properties on an interactive map
- Analyze property details and location

## Development Commands

```bash
npm run dev      # Start dev server with Turbopack (http://localhost:3000)
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run ESLint
```

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4 (dark theme)
- **Database**: Supabase (PostgreSQL)
- **Maps**: Leaflet with CartoDB dark tiles
- **Scraping**: Cheerio
- **Geocoding**: Nominatim (OpenStreetMap)

## Architecture

### Directory Structure
```
src/
├── app/                    # Next.js App Router pages
│   ├── api/               # API route handlers
│   │   ├── properties/    # CRUD for properties
│   │   ├── scrape/        # URL scraping endpoint
│   │   └── geocode/       # Address geocoding
│   ├── add-property/      # Add property page
│   ├── properties/[id]/   # Property detail page
│   └── map/               # Fullscreen map view
├── lib/
│   ├── supabase/          # Supabase client configuration
│   ├── scrapers/          # Site-specific scrapers (Cheerio)
│   ├── geocoding/         # Nominatim integration
│   └── utils/             # Helpers (user-agents, url-detector)
├── components/
│   ├── ui/                # Base components (Button, Input, Card)
│   ├── property/          # Property-related components
│   ├── scraper/           # URL input and preview
│   └── map/               # Leaflet map components
└── types/                 # TypeScript type definitions
```

### Key Patterns

**Route Handlers (Next.js 16)**: Dynamic params are promises that must be awaited:
```typescript
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // ...
}
```

**Scraper Architecture**: Abstract base class with site-specific implementations. Factory pattern in `lib/scrapers/index.ts` selects the correct scraper based on URL.

**Map Components**: Use dynamic imports with `ssr: false` to avoid Leaflet SSR issues:
```typescript
const PropertyMap = dynamic(
  () => import("@/components/map/property-map").then((mod) => mod.PropertyMap),
  { ssr: false }
);
```

## Database

Supabase PostgreSQL with a single `properties` table. Migration file: `supabase/migrations/001_create_properties.sql`

Key fields: `id`, `title`, `address`, `price`, `bedrooms`, `bathrooms`, `sqft`, `latitude`, `longitude`, `images`, `source_url`

## Environment Variables

Required in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

## Adding New Scrapers

1. Create a new file in `src/lib/scrapers/` extending `BaseScraper`
2. Implement all abstract extraction methods
3. Register in `src/lib/scrapers/index.ts`
