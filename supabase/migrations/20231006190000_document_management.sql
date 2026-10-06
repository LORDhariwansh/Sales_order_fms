-- Migration 00004_document_management.sql

-- 1. Create Private Storage Bucket (requires storage schema to exist, standard in Supabase)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'fms-documents', 
    'fms-documents', 
    false, 
    20971520, -- 20 MB limit
    '{application/pdf,image/jpeg,image/png,image/webp}'
)
ON CONFLICT (id) DO UPDATE SET 
    public = false, 
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Expand 'documents' table to meet comprehensive metadata requirements
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS file_name TEXT;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS mime_type TEXT;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS file_size BIGINT;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1;

-- 3. Storage Object RLS Policies
-- Enable RLS on objects if not already enabled (Supabase standard)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view/download objects in fms-documents bucket
CREATE POLICY "Allow authenticated read fms-documents" 
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'fms-documents');

-- Allow authenticated users to upload objects to fms-documents bucket
CREATE POLICY "Allow authenticated upload fms-documents" 
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'fms-documents');

-- Allow MIS or Admin to delete objects
CREATE POLICY "Allow Admin/MIS delete fms-documents" 
ON storage.objects FOR DELETE TO authenticated
USING (
    bucket_id = 'fms-documents' AND 
    public.user_has_role('MIS') OR public.user_has_role('Admin')
);

-- 4. Update Database Metadata RLS Policies
-- Allow authorized users to delete metadata records
CREATE POLICY "Admin MIS delete document metadata"
ON public.documents FOR DELETE TO authenticated
USING (public.user_has_role('MIS') OR public.user_has_role('Admin'));

