-- Migration 00002_workflow_engine.sql

-- 1. Create missing configuration tables for dynamic workflows
CREATE TABLE workflow_dependencies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stage_id UUID NOT NULL REFERENCES workflow_stages(id) ON DELETE CASCADE,
    depends_on_stage_id UUID NOT NULL REFERENCES workflow_stages(id) ON DELETE CASCADE,
    UNIQUE(stage_id, depends_on_stage_id)
);

CREATE TABLE workflow_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    description TEXT,
    condition_field TEXT NOT NULL,
    condition_operator TEXT NOT NULL,
    condition_value TEXT NOT NULL
);

CREATE TABLE workflow_transitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_stage_id UUID REFERENCES workflow_stages(id) ON DELETE CASCADE,
    to_stage_id UUID NOT NULL REFERENCES workflow_stages(id) ON DELETE CASCADE,
    rule_id UUID REFERENCES workflow_rules(id) ON DELETE SET NULL
);

-- RLS
ALTER TABLE workflow_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_transitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY ""Public read deps"" ON workflow_dependencies FOR SELECT TO authenticated USING (true);
CREATE POLICY ""Public read rules"" ON workflow_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY ""Public read transitions"" ON workflow_transitions FOR SELECT TO authenticated USING (true);

-- 2. Core RPC Functions for Workflow Engine

CREATE OR REPLACE FUNCTION is_stage_blocked(p_order_id UUID, p_stage_id UUID)
RETURNS BOOLEAN AS $$$
DECLARE
    v_blocked BOOLEAN := FALSE;
BEGIN
    SELECT EXISTS (
        SELECT 1 
        FROM workflow_dependencies wd
        LEFT JOIN order_stages os ON os.stage_id = wd.depends_on_stage_id AND os.order_id = p_order_id
        WHERE wd.stage_id = p_stage_id 
        AND (os.status IS NULL OR os.status NOT IN ('Completed', 'Skipped'))
    ) INTO v_blocked;
    RETURN v_blocked;
END;
$$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION can_start_stage(p_order_id UUID, p_stage_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$$
DECLARE
    v_blocked BOOLEAN;
    v_has_role BOOLEAN;
    v_role_id UUID;
BEGIN
    -- Check if blocked
    v_blocked := is_stage_blocked(p_order_id, p_stage_id);
    IF v_blocked THEN RETURN FALSE; END IF;

    -- Check if user has required role
    SELECT responsible_role_id INTO v_role_id FROM workflow_stages WHERE id = p_stage_id;
    
    SELECT EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = p_user_id AND role_id = v_role_id
    ) INTO v_has_role;
    
    RETURN v_has_role;
END;
$$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION complete_stage(
    p_order_stage_id UUID,
    p_user_id UUID,
    p_checklist_payload JSONB
) RETURNS JSONB AS $$$
DECLARE
    v_order_id UUID;
    v_stage_id UUID;
    v_status TEXT;
    v_next_stage_id UUID;
    v_tat_hours INTEGER;
    v_deadline TIMESTAMPTZ;
    v_cn_applicable BOOLEAN;
    v_new_order_stage_id UUID;
    v_missing_count INTEGER;
    v_key TEXT;
    v_val TEXT;
BEGIN
    -- 1. Lock row to prevent concurrent conflicting updates
    SELECT order_id, stage_id, status 
    INTO v_order_id, v_stage_id, v_status
    FROM order_stages
    WHERE id = p_order_stage_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order stage not found.';
    END IF;

    IF v_status = 'Completed' THEN
        RAISE EXCEPTION 'Stage is already completed. Duplicate completion blocked.';
    END IF;

    IF is_stage_blocked(v_order_id, v_stage_id) THEN
        RAISE EXCEPTION 'Stage is blocked by unfulfilled dependencies.';
    END IF;

    -- 2. Validate checklist requirements
    SELECT count(*) INTO v_missing_count
    FROM checklist_items ci
    WHERE ci.stage_id = v_stage_id
      AND ci.is_required = TRUE
      AND (p_checklist_payload->>ci.id::text) IS NULL;

    IF v_missing_count > 0 THEN
        RAISE EXCEPTION 'Missing % required checklist items.', v_missing_count;
    END IF;

    -- 3. Save submitted data
    FOR v_key, v_val IN SELECT * FROM jsonb_each_text(p_checklist_payload)
    LOOP
        INSERT INTO order_checklist_answers(order_stage_id, item_id, response_value)
        VALUES (p_order_stage_id, v_key::UUID, v_val)
        ON CONFLICT (order_stage_id, item_id) DO UPDATE SET response_value = v_val;
    END LOOP;

    -- 4. Complete current stage
    UPDATE order_stages
    SET status = 'Completed',
        actual_date = NOW(),
        completed_by = p_user_id
    WHERE id = p_order_stage_id;

    -- 5. Determine next stage (Rule evaluation)
    SELECT cn_applicable INTO v_cn_applicable FROM orders WHERE id = v_order_id;

    SELECT to_stage_id INTO v_next_stage_id
    FROM workflow_transitions wt
    LEFT JOIN workflow_rules wr ON wt.rule_id = wr.id
    WHERE wt.from_stage_id = v_stage_id
      AND (
          wr.id IS NULL OR 
          (wr.condition_field = 'cn_applicable' AND wr.condition_value = v_cn_applicable::text)
      )
    ORDER BY wr.id NULLS LAST
    LIMIT 1;

    -- 6. Task creation & Deadline
    IF v_next_stage_id IS NOT NULL THEN
        SELECT tat_hours INTO v_tat_hours FROM workflow_stages WHERE id = v_next_stage_id;
        v_deadline := calculate_deadline(NOW(), v_tat_hours);

        INSERT INTO order_stages(order_id, stage_id, status, planned_date)
        VALUES (v_order_id, v_next_stage_id, 'Pending', v_deadline)
        RETURNING id INTO v_new_order_stage_id;
    END IF;

    -- Audit logs are handled automatically by the trg_audit_orders and a new one for order_stages.

    RETURN jsonb_build_object('success', true, 'next_stage_id', v_new_order_stage_id);
END;
$$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add Audit Trigger for order_stages
CREATE TRIGGER trg_audit_order_stages
AFTER UPDATE ON order_stages
FOR EACH ROW EXECUTE FUNCTION log_order_changes();

