-- Fix RLS policies for centris-raw storage bucket to allow server-side operations
-- The previous policies were too restrictive for server-side API calls

-- Drop existing policies
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated reads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes" ON storage.objects;

-- Create more permissive policies that work with server-side API
-- These policies check if the bucket_id is 'centris-raw' without requiring authenticated user

-- Allow all inserts to centris-raw bucket
CREATE POLICY "Allow centris-raw uploads"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'centris-raw');

-- Allow all reads from centris-raw bucket
CREATE POLICY "Allow centris-raw reads"
ON storage.objects FOR SELECT
USING (bucket_id = 'centris-raw');

-- Allow all updates to centris-raw bucket
CREATE POLICY "Allow centris-raw updates"
ON storage.objects FOR UPDATE
USING (bucket_id = 'centris-raw')
WITH CHECK (bucket_id = 'centris-raw');

-- Allow all deletes from centris-raw bucket
CREATE POLICY "Allow centris-raw deletes"
ON storage.objects FOR DELETE
USING (bucket_id = 'centris-raw');

-- Add comment
COMMENT ON POLICY "Allow centris-raw uploads" ON storage.objects IS
'Allow server-side API to upload to centris-raw bucket';
