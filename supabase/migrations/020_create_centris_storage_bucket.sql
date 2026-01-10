-- Create storage bucket for raw Centris rental data
-- Stores raw JSON files with date-based partitioning: {YYYY}/{MM}/{centris_id}.json

INSERT INTO storage.buckets (id, name, public)
VALUES ('centris-raw', 'centris-raw', false)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for centris-raw bucket
-- Allow authenticated users to upload raw scraping data
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'centris-raw');

-- Allow authenticated users to read raw data
CREATE POLICY "Allow authenticated reads"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'centris-raw');

-- Allow authenticated users to delete old raw data
CREATE POLICY "Allow authenticated deletes"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'centris-raw');
