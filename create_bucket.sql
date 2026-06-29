-- Run this in your Supabase SQL Editor to create the bucket for PR Attachments
INSERT INTO storage.buckets (id, name, public) 
VALUES ('pr-attachments', 'pr-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public access to read files
CREATE POLICY "Public Access" 
ON storage.objects FOR SELECT 
USING ( bucket_id = 'pr-attachments' );

-- Allow authenticated users to upload files
CREATE POLICY "Auth Upload" 
ON storage.objects FOR INSERT 
WITH CHECK ( bucket_id = 'pr-attachments' AND auth.role() = 'authenticated' );

-- If you are not using Auth right now and want to allow anonymous uploads (for testing):
CREATE POLICY "Anon Upload" 
ON storage.objects FOR INSERT 
WITH CHECK ( bucket_id = 'pr-attachments' );
