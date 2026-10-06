-- Migration 00005_document_workflow_link.sql

-- Link documents directly to the workflow stage where they were uploaded
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS order_stage_id UUID REFERENCES order_stages(id) ON DELETE SET NULL;

