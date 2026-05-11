-- Create public bucket for PT completion signatures
INSERT INTO storage.buckets (id, name, public)
VALUES ('signatures', 'signatures', true)
ON CONFLICT (id) DO NOTHING;

-- Public read
CREATE POLICY "Signatures are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'signatures');

-- Authenticated users can upload to signatures
CREATE POLICY "Authenticated users can upload signatures"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'signatures');

-- Owners can update their files
CREATE POLICY "Users can update own signatures"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'signatures' AND auth.uid() = owner);

-- Owners can delete their files
CREATE POLICY "Users can delete own signatures"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'signatures' AND auth.uid() = owner);
