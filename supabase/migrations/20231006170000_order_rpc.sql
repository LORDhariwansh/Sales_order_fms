-- Add the RPC for order creation
CREATE OR REPLACE FUNCTION create_new_order(
    p_submission_id TEXT,
    p_customer_id UUID,
    p_delivery_address_id UUID,
    p_salesman_id UUID,
    p_cn_applicable BOOLEAN,
    p_first_stage_id UUID
) RETURNS UUID AS $$$
DECLARE
    v_order_id UUID;
    v_tat_hours INTEGER;
    v_deadline TIMESTAMPTZ;
BEGIN
    INSERT INTO orders(submission_id, customer_id, delivery_address_id, salesman_id, cn_applicable, status, is_archived)
    VALUES (p_submission_id, p_customer_id, p_delivery_address_id, p_salesman_id, p_cn_applicable, 'Active', false)
    RETURNING id INTO v_order_id;

    SELECT tat_hours INTO v_tat_hours FROM workflow_stages WHERE id = p_first_stage_id;
    v_deadline := calculate_deadline(NOW(), v_tat_hours);

    INSERT INTO order_stages(order_id, stage_id, status, planned_date)
    VALUES (v_order_id, p_first_stage_id, 'Pending', v_deadline);

    RETURN v_order_id;
END;
$$$ LANGUAGE plpgsql SECURITY DEFINER;
