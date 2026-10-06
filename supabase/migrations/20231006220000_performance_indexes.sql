-- Migration 00008_performance_indexes.sql

-- 1. Order List Search & Filtering
-- The UI frequently filters by status, archive status, and created_at. 
-- A composite index significantly speeds up the dashboard CTE and OrderList filters.
CREATE INDEX IF NOT EXISTS idx_orders_dashboard_filters 
ON orders (is_archived, status, created_at DESC, salesman_id);

-- Provide a trigram index for fast text searching on Record Numbers (submission_id)
-- Note: Requires pg_trgm extension. For standard b-tree, regular index exists, but ilike needs trgm or exact match.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_orders_submission_id_trgm 
ON orders USING gin (submission_id gin_trgm_ops);

-- 2. Workflow Joins
-- Order stages are joined against orders heavily in OrderDetail and complete_stage RPC.
CREATE INDEX IF NOT EXISTS idx_order_stages_order_id 
ON order_stages (order_id);

CREATE INDEX IF NOT EXISTS idx_order_stages_stage_id 
ON order_stages (stage_id);

-- 3. Checklists
-- Used heavily by the complete_stage_advanced RPC validation.
CREATE INDEX IF NOT EXISTS idx_order_checklist_items_lookup 
ON order_checklist_items (order_checklist_id, is_completed);

-- 4. Documents
-- DocumentManager fetches documents by order_id ordered by type and version.
CREATE INDEX IF NOT EXISTS idx_documents_order_id 
ON documents (order_id, document_type, version DESC);
