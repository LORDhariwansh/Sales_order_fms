-- Migration 00003_checklist_system.sql

-- 1. Refine Checklist Schema to match requirements
CREATE TABLE checklists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stage_id UUID NOT NULL REFERENCES workflow_stages(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT
);

-- Drop previous simple table if it exists (for safe migration path)
DROP TABLE IF EXISTS order_checklist_answers CASCADE;
DROP TABLE IF EXISTS checklist_items CASCADE;

CREATE TABLE checklist_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    checklist_id UUID NOT NULL REFERENCES checklists(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    description TEXT,
    is_required BOOLEAN DEFAULT TRUE,
    requires_attachment BOOLEAN DEFAULT FALSE,
    expected_type TEXT DEFAULT 'boolean' -- boolean, text, date
);

CREATE TABLE order_checklists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_stage_id UUID NOT NULL REFERENCES order_stages(id) ON DELETE CASCADE,
    checklist_id UUID NOT NULL REFERENCES checklists(id) ON DELETE CASCADE,
    UNIQUE(order_stage_id, checklist_id)
);

CREATE TABLE order_checklist_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_checklist_id UUID NOT NULL REFERENCES order_checklists(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES checklist_items(id) ON DELETE CASCADE,
    is_completed BOOLEAN DEFAULT FALSE,
    completed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    completed_at TIMESTAMPTZ,
    remarks TEXT,
    attachment_url TEXT,
    UNIQUE(order_checklist_id, item_id)
);

-- RLS
ALTER TABLE checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY ""Public read checklists"" ON checklists FOR SELECT TO authenticated USING (true);
CREATE POLICY ""Public read checklist items"" ON checklist_items FOR SELECT TO authenticated USING (true);
CREATE POLICY ""Public read order_checklists"" ON order_checklists FOR SELECT TO authenticated USING (true);
CREATE POLICY ""Public read order_checklist_items"" ON order_checklist_items FOR SELECT TO authenticated USING (true);

CREATE POLICY ""Auth update order_checklist_items"" ON order_checklist_items FOR UPDATE TO authenticated USING (true);
CREATE POLICY ""Auth insert order_checklist_items"" ON order_checklist_items FOR INSERT TO authenticated WITH CHECK (true);

-- 2. Seed Actual FMS Stages & Rules based on Reverse Engineering
DO $$$
DECLARE
    role_create UUID;
    role_admin UUID;
    role_sc UUID;
    role_pricelist UUID;
    role_ca UUID;

    stage_pi_entry UUID;
    stage_pi_maker UUID;
    stage_pricelist UUID;
    stage_admin UUID;
    stage_po UUID;
    stage_pi_checker UUID;
    stage_rc UUID;
    stage_dispatch UUID;
    stage_invoice UUID;
    
    cl_pi UUID;
    cl_rc UUID;
    cl_dispatch UUID;
    cl_invoice UUID;
BEGIN
    -- Seed Roles
    INSERT INTO roles (name, description) VALUES 
    ('Create', 'Order Entry'), 
    ('Admin', 'Admin Approver'), 
    ('SC', 'Supply Chain'), 
    ('Pricelist', 'Pricing'), 
    ('CA', 'Accounts')
    ON CONFLICT (name) DO NOTHING;

    SELECT id INTO role_create FROM roles WHERE name = 'Create';
    SELECT id INTO role_admin FROM roles WHERE name = 'Admin';
    SELECT id INTO role_sc FROM roles WHERE name = 'SC';
    SELECT id INTO role_pricelist FROM roles WHERE name = 'Pricelist';
    SELECT id INTO role_ca FROM roles WHERE name = 'CA';

    -- Seed Stages
    INSERT INTO workflow_stages (stage_name, sequence_order, tat_hours, responsible_role_id) VALUES
    ('Order Entry', 10, 1, role_create),
    ('PI Maker', 20, 1, role_create),
    ('Pricelist', 30, 1, role_pricelist),
    ('Admin Approval', 40, 1, role_admin),
    ('Send PO', 50, 1, role_create),
    ('PI Checker', 60, 2, role_admin),
    ('RC & Vehicle', 70, 1, role_sc),
    ('Dispatch', 80, 1, role_sc),
    ('Invoice Upload', 90, 2, role_ca)
    ON CONFLICT (stage_name) DO NOTHING;

    SELECT id INTO stage_pi_entry FROM workflow_stages WHERE stage_name = 'Order Entry';
    SELECT id INTO stage_pi_maker FROM workflow_stages WHERE stage_name = 'PI Maker';
    SELECT id INTO stage_pricelist FROM workflow_stages WHERE stage_name = 'Pricelist';
    SELECT id INTO stage_admin FROM workflow_stages WHERE stage_name = 'Admin Approval';
    SELECT id INTO stage_po FROM workflow_stages WHERE stage_name = 'Send PO';
    SELECT id INTO stage_pi_checker FROM workflow_stages WHERE stage_name = 'PI Checker';
    SELECT id INTO stage_rc FROM workflow_stages WHERE stage_name = 'RC & Vehicle';
    SELECT id INTO stage_dispatch FROM workflow_stages WHERE stage_name = 'Dispatch';
    SELECT id INTO stage_invoice FROM workflow_stages WHERE stage_name = 'Invoice Upload';

    -- Seed Dependencies (Linear for simplification, though actual allows some parallel)
    INSERT INTO workflow_dependencies (stage_id, depends_on_stage_id) VALUES
    (stage_pi_maker, stage_pi_entry),
    (stage_pricelist, stage_pi_maker),
    (stage_admin, stage_pricelist),
    (stage_po, stage_admin),
    (stage_pi_checker, stage_po),
    (stage_rc, stage_pi_checker),
    (stage_dispatch, stage_rc),
    (stage_invoice, stage_dispatch)
    ON CONFLICT DO NOTHING;

    -- Seed Checklists
    INSERT INTO checklists (stage_id, name) VALUES 
    (stage_pi_maker, 'PI Maker Checklist'),
    (stage_rc, 'RC & Vehicle Checklist'),
    (stage_dispatch, 'Dispatch Validation'),
    (stage_invoice, 'Invoice Documents')
    RETURNING id;

    SELECT id INTO cl_pi FROM checklists WHERE name = 'PI Maker Checklist';
    SELECT id INTO cl_rc FROM checklists WHERE name = 'RC & Vehicle Checklist';
    SELECT id INTO cl_dispatch FROM checklists WHERE name = 'Dispatch Validation';
    SELECT id INTO cl_invoice FROM checklists WHERE name = 'Invoice Documents';

    -- Checklist Items
    INSERT INTO checklist_items (checklist_id, label, requires_attachment) VALUES
    (cl_pi, 'PI Drafted Correctly', false),
    (cl_rc, 'Vehicle Matched with Invoice & E-Way Bill', true),
    (cl_dispatch, 'Gatepass Uploaded', true),
    (cl_invoice, 'New Invoice Uploaded', true),
    (cl_invoice, 'Summary Uploaded', true),
    (cl_invoice, 'Bilty Uploaded', true);

END;
$$$;

-- 3. Update complete_stage RPC to validate new schema
CREATE OR REPLACE FUNCTION complete_stage_advanced(
    p_order_stage_id UUID,
    p_user_id UUID
) RETURNS JSONB AS $$$
DECLARE
    v_missing_count INTEGER;
BEGIN
    -- Validate checklist requirements strictly
    SELECT COUNT(*) INTO v_missing_count
    FROM checklist_items ci
    JOIN checklists cl ON ci.checklist_id = cl.id
    JOIN order_stages os ON os.stage_id = cl.stage_id
    LEFT JOIN order_checklists oc ON oc.order_stage_id = os.id AND oc.checklist_id = cl.id
    LEFT JOIN order_checklist_items oci ON oci.item_id = ci.id AND oci.order_checklist_id = oc.id
    WHERE os.id = p_order_stage_id
      AND ci.is_required = TRUE
      AND (oci.is_completed IS FALSE OR oci.is_completed IS NULL);

    IF v_missing_count > 0 THEN
        RAISE EXCEPTION 'Cannot complete stage. % required checklist items remain incomplete.', v_missing_count;
    END IF;

    -- Complete stage logic (simplified for snippet)
    UPDATE order_stages
    SET status = 'Completed', actual_date = NOW(), completed_by = p_user_id
    WHERE id = p_order_stage_id;

    RETURN jsonb_build_object('success', true);
END;
$$$ LANGUAGE plpgsql SECURITY DEFINER;
