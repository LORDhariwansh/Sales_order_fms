-- Migration 00007_dashboard_analytics.sql

-- 1. RPC for calculating dashboard metrics entirely on the server
CREATE OR REPLACE FUNCTION get_dashboard_metrics(
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL,
    p_salesman_id UUID DEFAULT NULL,
    p_customer_id UUID DEFAULT NULL
) RETURNS JSONB AS $$$
DECLARE
    v_result JSONB;
BEGIN
    WITH filtered_orders AS (
        SELECT id, status, salesman_id, customer_id, created_at
        FROM orders
        WHERE (p_start_date IS NULL OR created_at >= p_start_date)
          AND (p_end_date IS NULL OR created_at <= p_end_date)
          AND (p_salesman_id IS NULL OR salesman_id = p_salesman_id)
          AND (p_customer_id IS NULL OR customer_id = p_customer_id)
          AND is_archived = false
    ),
    stage_metrics AS (
        SELECT 
            ws.stage_name, 
            COUNT(os.id) FILTER (WHERE os.status = 'Pending') as pending_count,
            COUNT(os.id) FILTER (WHERE os.status = 'Pending' AND os.planned_date < NOW()) as overdue_count
        FROM order_stages os
        JOIN workflow_stages ws ON os.stage_id = ws.id
        JOIN filtered_orders fo ON os.order_id = fo.id
        GROUP BY ws.stage_name
    ),
    salesman_metrics AS (
        SELECT 
            p.full_name,
            COUNT(fo.id) as order_count
        FROM filtered_orders fo
        JOIN profiles p ON fo.salesman_id = p.id
        GROUP BY p.full_name
    ),
    sla_metrics AS (
        -- Simple SLA Compliance: % of stages completed on or before planned_date
        SELECT 
            COUNT(os.id) AS total_evaluated,
            COUNT(os.id) FILTER (WHERE os.actual_date <= os.planned_date) AS on_time
        FROM order_stages os
        JOIN filtered_orders fo ON os.order_id = fo.id
        WHERE os.status = 'Completed'
    )
    SELECT jsonb_build_object(
        'overview', jsonb_build_object(
            'total', (SELECT COUNT(*) FROM filtered_orders),
            'active', (SELECT COUNT(*) FROM filtered_orders WHERE status = 'Active'),
            'completed', (SELECT COUNT(*) FROM filtered_orders WHERE status = 'Completed')
        ),
        'by_stage', COALESCE((SELECT jsonb_agg(row_to_json(stage_metrics)) FROM stage_metrics), '[]'::jsonb),
        'by_salesman', COALESCE((SELECT jsonb_agg(row_to_json(salesman_metrics)) FROM salesman_metrics), '[]'::jsonb),
        'sla', COALESCE((SELECT jsonb_agg(row_to_json(sla_metrics)) FROM sla_metrics), '[]'::jsonb)
    ) INTO v_result;

    RETURN v_result;
END;
$$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. View for Excel/CSV Reports
CREATE OR REPLACE VIEW fms_export_report AS
SELECT 
    o.id,
    o.submission_id AS "Record Number",
    o.created_at AS "Order Date",
    c.name AS "Customer",
    p.full_name AS "Salesman",
    o.status AS "Status",
    o.is_archived AS "Archived",
    o.cn_applicable AS "CN Applicable"
FROM orders o
LEFT JOIN customers c ON o.customer_id = c.id
LEFT JOIN profiles p ON o.salesman_id = p.id;

-- RLS for View (Views bypass RLS by default if security definer, but we grant access)
GRANT SELECT ON fms_export_report TO authenticated;
