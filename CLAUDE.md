# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Properties-X is a Next.js 16 (App Router) application for managing real estate data in Quebec, Canada. It combines property scraping from real estate websites with Montreal's municipal property evaluation database, Quebec business registry integration, and zone-based property discovery. The app uses Supabase for the database and storage, React 19, TypeScript, and Tailwind CSS 4.

## Development Commands

```bash
# Development
npm run dev                    # Start Next.js dev server (http://localhost:3000)
npm run build                  # Build for production
npm run start                  # Start production server
npm run lint                   # Run ESLint

# Data Import Scripts (require .env.local)
npm run clean:evaluations      # Clean CSV evaluation data
npm run import:evaluations     # Import property evaluations from CSV
npm run import:evaluations:v2  # Import evaluations v2
npm run find:missing           # Find missing property data
npm run scrape:large           # Scrape large properties

# Running Scripts Directly
npx tsx scripts/[script-name].ts              # Without env
dotenv -e .env.local -- tsx scripts/[script-name].ts  # With env vars
```

## Environment Setup

Create `.env.local` based on `.env.example`:
- **NEXT_PUBLIC_SUPABASE_URL** and **NEXT_PUBLIC_SUPABASE_ANON_KEY**: Required for database access
- **BRIGHTDATA_PROXY_***: Required only for Quebec company registry scraping (bypasses Cloudflare)

## Architecture

### Core Data Models

**Properties** (`src/types/property.ts`)
- Main table for scraped real estate listings from sites like Centris
- Includes financial data: municipal assessment, taxes, expenses, potential revenue
- Supports multiple property types: single_family, duplex, triplex, quadruplex, multi_residential, etc.

**Property Evaluations** (`src/types/property-evaluation.ts`)
- Montreal's municipal evaluation database (CSV import)
- Contains official building data: matricule (unique building ID), construction year, units, area
- Geocoded with lat/lng for map display
- Linked to scraped properties via address matching

**Companies** (`src/types/company-registry.ts`)
- Quebec business registry data (Registraire des entreprises du Québec)
- Includes shareholders, administrators, and beneficial owners
- Can be linked to properties via `property_company_links` table

**Scraping Zones** (`src/types/scraping-zone.ts`)
- Geographic bounding boxes for discovering properties on Montreal's evaluation site
- Tracks scraping progress (total_properties, scraped_count)
- Supports unit filters (min_units, max_units) for targeting multi-residential buildings

**Rentals** (`src/types/rental.ts`)
- Rental listing data (primarily from Facebook Marketplace)
- Includes parsed JSON data with media stored in Supabase storage

### Scraping System

**Base Architecture** (`src/lib/scrapers/base-scraper.ts`)
- Abstract `BaseScraper` class with template pattern
- Handles HTTP requests with rotating user agents
- Each scraper implements extraction methods for all property fields
- Registry in `src/lib/scrapers/index.ts` selects appropriate scraper by URL pattern

**Implemented Scrapers**:
- `CentrisScraper`: Centris.ca (Quebec MLS)
- `GenericScraper`: Fallback for unsupported sites
- `MontrealEvaluationScraper`: Montreal's evaluation portal (address-based scraping)
- `QuebecCompanyScraper`: Quebec business registry (uses Bright Data proxy for Cloudflare bypass)

**Company Registry Scraping**:
- `src/lib/scrapers/quebec-company-scraper.ts`: Server-side scraping with Puppeteer + proxy
- `src/lib/scrapers/quebec-company-dom-extractor.ts`: Extract data from DOM structure
- `src/lib/bookmarklets/quebec-company-bookmarklet.ts`: Client-side bookmarklet for manual scraping
- Company data automatically linked to properties via address matching (`src/lib/company-registry/owner-matcher.ts`)

### API Routes Structure

All API routes follow Next.js App Router conventions in `src/app/api/`:

**Properties**:
- `GET /api/properties` - List properties with filters
- `GET /api/properties/[id]` - Get property details
- `POST /api/properties` - Create property
- `POST /api/scrape` - Scrape property from URL

**Property Evaluations**:
- `GET /api/property-evaluations` - List evaluations with filters
- `GET /api/property-evaluations/[id]` - Get evaluation details
- `POST /api/property-evaluations/[id]/scrape` - Scrape Montreal evaluation data
- `POST /api/property-evaluations/geocode` - Geocode evaluations
- `POST /api/property-evaluations/toggle-map` - Toggle map visibility

**Zones**:
- `GET /api/zones` - List scraping zones
- `POST /api/zones` - Create zone
- `GET /api/zones/[id]` - Get zone details
- `GET /api/zones/[id]/stats` - Get zone statistics
- `GET /api/zones/[id]/properties` - List properties in zone
- `POST /api/zones/[id]/scrape-single` - Scrape single property in zone

**Companies**:
- `GET /api/companies` - List companies
- `POST /api/companies` - Create company
- `GET /api/companies/[id]/properties` - Get properties linked to company
- `POST /api/company-registry` - Scrape company by NEQ or name
- `POST /api/companies/scrape` - Scrape company (legacy)
- `POST /api/companies/bookmarklet` - Receive bookmarklet data

**Rentals**:
- `GET /api/rentals` - List rentals
- `POST /api/rentals` - Create rental from JSON
- `GET /api/rentals/[id]` - Get rental details

### Component Organization

**UI Components** (`src/components/ui/`)
- Basic components: `button`, `input`, `select`, `card`, `badge`, `alert`, `textarea`, `loading-spinner`

**Map Components** (`src/components/map/`)
- Built with Leaflet and React Leaflet
- `property-map.tsx`: Display single property location
- `properties-map.tsx`: Display multiple properties with clustering
- `zone-drawing-map.tsx`: Draw and edit scraping zones
- `zone-buildings-map.tsx`: Display all buildings in a zone
- `company-properties-map.tsx`: Display all properties linked to a company
- `poi-layer-control.tsx`: Toggle POI layers (schools, parks, transit, etc.)

**Feature Components**:
- `src/components/property/`: Property cards and grids
- `src/components/evaluation/`: Evaluation tables, filters, and stats
- `src/components/zones/`: Zone management UI
- `src/components/scraper/`: URL input and preview
- `src/components/rental/`: Rental cards and JSON input

### Key Utilities

**Geocoding** (`src/lib/geocoding/`)
- `nominatim.ts`: Free geocoding via OpenStreetMap Nominatim
- `google.ts`: Google Maps Geocoding API (more accurate, costs money)

**Address Processing**:
- `src/lib/utils/street-name-cleaner.ts`: Normalize street names for matching
- `src/lib/company-registry/address-parser.ts`: Parse Quebec addresses into components
- `src/lib/company-registry/owner-matcher.ts`: Match company owners to property evaluations

**Storage**:
- `src/lib/storage/rental-media.ts`: Upload rental images to Supabase storage

### Database

**Supabase Integration**:
- Client-side: `src/lib/supabase/client.ts` (uses `@supabase/ssr` browser client)
- Server-side: `src/lib/supabase/server.ts` (uses `@supabase/ssr` server client)
- Type definitions: `src/lib/supabase/types.ts` (generated from Supabase schema)

**Migrations**: Located in `supabase/migrations/`, applied sequentially:
- 001-003: Core property tables
- 004-006: Property evaluations and geocoding
- 007-011: Scraping zones and Montreal evaluation details
- 012-016: Company registry tables
- 017-018: Rentals and storage

## Path Alias

The project uses `@/*` to reference `src/*`:
```typescript
import { Property } from '@/types/property';
import { createClient } from '@/lib/supabase/client';
```

## Important Patterns

### Scraper Extension
To add a new property listing site:
1. Create scraper in `src/lib/scrapers/[name]-scraper.ts` extending `BaseScraper`
2. Implement all abstract extraction methods
3. Define `sourceName` and `urlPattern`
4. Register in `src/lib/scrapers/index.ts`

### Montreal Evaluation Scraping
The Montreal evaluation database is scraped by:
1. Using scraping zones to define geographic areas of interest
2. Querying the evaluation database for properties within the zone bounds
3. For each property, constructing a search URL with the full address
4. Scraping the evaluation details page to extract financial data, ownership, and building characteristics
5. Storing in `montreal_evaluation_details` table linked to `property_evaluations` by matricule

### Company-Property Linking
Companies are linked to properties through:
1. Address matching: Parse company domicile addresses and match to property evaluation addresses
2. Owner name matching: Compare shareholder/administrator names to property owner names
3. Manual linking: Users can manually link via `property_company_links` table
4. Confidence levels: `exact`, `fuzzy`, or `manual`

### Bookmarklet System
Quebec company bookmarklet allows manual data extraction:
1. User visits Quebec business registry page
2. Clicks bookmarklet which extracts DOM data via `quebec-company-dom-extractor.ts`
3. Data sent to `/api/companies/bookmarklet` endpoint
4. Company saved and auto-linked to properties

## Testing Property Scraping

1. Use the `/add-property` page to test URL scraping
2. Or call `POST /api/scrape` with `{ url: "..." }`
3. Check browser network tab for detailed error messages
4. Scrapers use rotating user agents to avoid detection

## Common Data Import Workflow

1. Get Montreal property evaluation CSV from city's open data portal
2. Clean CSV: `npm run clean:evaluations`
3. Import to DB: `npm run import:evaluations:v2`
4. Geocode addresses: Run geocoding script or use API endpoint
5. Create scraping zones on `/zones` page by drawing on map
6. Scrape properties within zones
7. View results on `/map` page with filters
