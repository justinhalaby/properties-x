// Types for zone-based scraping system

export interface ScrapingZone {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  description: string | null;
  min_lat: number;
  max_lat: number;
  min_lng: number;
  max_lng: number;
  total_properties: number;
  scraped_count: number;
  last_scraped_at: string | null;
  target_limit: number | null;
  min_units: number;
  max_units: number | null;
}

export interface ScrapingZoneInsert {
  name: string;
  description?: string;
  min_lat: number;
  max_lat: number;
  min_lng: number;
  max_lng: number;
  target_limit?: number;
  min_units?: number;
  max_units?: number | null;
  total_properties?: number;
  scraped_count?: number;
}

export interface ScrapingZoneUpdate {
  name?: string;
  description?: string;
  min_lat?: number;
  max_lat?: number;
  min_lng?: number;
  max_lng?: number;
  target_limit?: number;
  min_units?: number;
  max_units?: number | null;
  total_properties?: number;
  scraped_count?: number;
  last_scraped_at?: string;
}

export interface ZoneScrapingJob {
  id: string;
  zone_id: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  requested_limit: number;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  total_to_scrape: number;
  scraped_count: number;
  failed_count: number;
  error_message: string | null;
  summary: Record<string, any> | null;
}

export interface ZoneBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export interface ZoneStatistics {
  total_properties: number;
  scraped_properties: number;
  unscraped_properties: number;
  percentage_complete: number;
}
