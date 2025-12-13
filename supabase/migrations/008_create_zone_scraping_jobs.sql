-- Create table for tracking scraping job progress
-- Migration: 008_create_zone_scraping_jobs

CREATE TABLE zone_scraping_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id UUID NOT NULL REFERENCES scraping_zones(id) ON DELETE CASCADE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Job configuration
  requested_limit INTEGER NOT NULL,

  -- Progress tracking
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'running', 'completed', 'failed', 'cancelled')
  ),
  total_to_scrape INTEGER DEFAULT 0,
  scraped_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,

  -- Error tracking
  error_message TEXT,

  -- Results summary
  summary JSONB
);

-- Indexes
CREATE INDEX idx_zone_jobs_zone_id ON zone_scraping_jobs(zone_id);
CREATE INDEX idx_zone_jobs_status ON zone_scraping_jobs(status);
CREATE INDEX idx_zone_jobs_created_at ON zone_scraping_jobs(created_at DESC);

-- RLS Policies
ALTER TABLE zone_scraping_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to zone jobs"
  ON zone_scraping_jobs FOR SELECT USING (true);

CREATE POLICY "Allow authenticated insert for zone jobs"
  ON zone_scraping_jobs FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow authenticated update for zone jobs"
  ON zone_scraping_jobs FOR UPDATE USING (true);

-- Comments
COMMENT ON TABLE zone_scraping_jobs IS
  'Tracks individual scraping job runs for zones';

COMMENT ON COLUMN zone_scraping_jobs.zone_id IS 'Foreign key to scraping_zones table';
COMMENT ON COLUMN zone_scraping_jobs.requested_limit IS 'Maximum number of properties requested to scrape';
COMMENT ON COLUMN zone_scraping_jobs.status IS 'Current job status: pending, running, completed, failed, cancelled';
COMMENT ON COLUMN zone_scraping_jobs.total_to_scrape IS 'Actual number of unscraped properties found in zone (may be less than requested_limit)';
COMMENT ON COLUMN zone_scraping_jobs.scraped_count IS 'Number of properties successfully scraped so far';
COMMENT ON COLUMN zone_scraping_jobs.failed_count IS 'Number of properties that failed to scrape';
COMMENT ON COLUMN zone_scraping_jobs.summary IS 'JSON summary of job results including statistics and any notable events';
