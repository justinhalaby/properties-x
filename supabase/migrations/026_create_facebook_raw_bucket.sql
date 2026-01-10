-- Create facebook-raw-rentals bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('facebook-raw-rentals', 'facebook-raw-rentals', false);

-- RLS policies for service role access
CREATE POLICY "Service role full access"
ON storage.objects FOR ALL
TO service_role
USING (bucket_id = 'facebook-raw-rentals')
WITH CHECK (bucket_id = 'facebook-raw-rentals');
