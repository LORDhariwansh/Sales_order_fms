-- Migration 00001_initial_schema.sql

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Authentication & Authorization
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL,
    description TEXT
);

CREATE TABLE profiles (
    id UUID PRIMARY KEY, -- References auth.users in Supabase
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    whatsapp_id TEXT
);

CREATE TABLE user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    UNIQUE(user_id, role_id)
);

CREATE TABLE leave_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    CONSTRAINT valid_leave_dates CHECK (end_date >= start_date)
);

-- 2. Master Data Configuration
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    is_special BOOLEAN DEFAULT FALSE,
    default_salesman_id UUID REFERENCES profiles(id) ON DELETE SET NULL
);
CREATE INDEX idx_customers_name ON customers(name);

CREATE TABLE customer_addresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    address_code TEXT NOT NULL,
    address_text TEXT NOT NULL,
    UNIQUE(customer_id, address_code)
);

CREATE TABLE transporters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL,
    type TEXT
);

CREATE TABLE holidays (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    holiday_date DATE UNIQUE NOT NULL,
    description TEXT
);

-- 3. Workflow Engine Definition
CREATE TABLE workflow_stages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stage_name TEXT UNIQUE NOT NULL,
    sequence_order INTEGER NOT NULL,
    tat_hours INTEGER DEFAULT 1,
    responsible_role_id UUID REFERENCES roles(id) ON DELETE RESTRICT
);

CREATE TABLE checklist_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stage_id UUID NOT NULL REFERENCES workflow_stages(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    is_required BOOLEAN DEFAULT TRUE,
    expected_type TEXT DEFAULT 'text'
);

-- 4. Transactional Data
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id TEXT UNIQUE NOT NULL,
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
    delivery_address_id UUID NOT NULL REFERENCES customer_addresses(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Completed', 'Cancelled')),
    is_archived BOOLEAN DEFAULT FALSE,
    cn_applicable BOOLEAN DEFAULT FALSE,
    salesman_id UUID REFERENCES profiles(id) ON DELETE SET NULL
);
CREATE INDEX idx_orders_submission ON orders(submission_id);
CREATE INDEX idx_orders_customer ON orders(customer_id);

CREATE TABLE order_stages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    stage_id UUID NOT NULL REFERENCES workflow_stages(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'In Progress', 'Skipped', 'Completed', 'Rejected')),
    planned_date TIMESTAMPTZ,
    actual_start TIMESTAMPTZ,
    actual_date TIMESTAMPTZ,
    completed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    UNIQUE(order_id, stage_id)
);
CREATE INDEX idx_order_stages_status ON order_stages(status);

CREATE TABLE order_checklist_answers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_stage_id UUID NOT NULL REFERENCES order_stages(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES checklist_items(id) ON DELETE CASCADE,
    response_value TEXT,
    UNIQUE(order_stage_id, item_id)
);

-- 5. Sub-Domain Entities
CREATE TABLE dispatch (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
    transporter_id UUID NOT NULL REFERENCES transporters(id) ON DELETE RESTRICT,
    vehicle_number TEXT,
    driver_contact TEXT,
    weight_kg NUMERIC CHECK (weight_kg >= 0),
    advance_amount NUMERIC CHECK (advance_amount >= 0)
);

CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
    invoice_number TEXT UNIQUE NOT NULL,
    invoice_amount NUMERIC NOT NULL CHECK (invoice_amount >= 0),
    quantity INTEGER CHECK (quantity >= 0),
    docket_no TEXT,
    eway_bill_expiry DATE
);

CREATE TABLE credit_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    remark TEXT,
    approval_status TEXT DEFAULT 'Pending' CHECK (approval_status IN ('Pending', 'Approved', 'Rejected'))
);

CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL,
    storage_path TEXT NOT NULL CHECK (storage_path <> ''),
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    old_state JSONB,
    new_state JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. TAT Engine Functions

CREATE OR REPLACE FUNCTION calculate_deadline(start_time TIMESTAMPTZ, tat_hours INTEGER) 
RETURNS TIMESTAMPTZ AS $$
DECLARE
    current_time TIMESTAMPTZ := start_time;
    remaining_hours INTEGER := tat_hours;
    available_hours NUMERIC;
    start_hour CONSTANT TIME := '10:00:00';
    end_hour CONSTANT TIME := '20:00:00';
    is_holiday BOOLEAN;
BEGIN
    WHILE remaining_hours > 0 LOOP
        IF current_time::TIME >= end_hour THEN
            current_time := (current_time::DATE + INTERVAL '1 day')::DATE + start_hour;
        ELSIF current_time::TIME < start_hour THEN
            current_time := current_time::DATE + start_hour;
        END IF;

        IF EXTRACT(DOW FROM current_time) = 0 THEN
            current_time := (current_time::DATE + INTERVAL '1 day')::DATE + start_hour;
            CONTINUE;
        END IF;

        SELECT EXISTS(SELECT 1 FROM holidays WHERE holiday_date = current_time::DATE) INTO is_holiday;
        IF is_holiday THEN
            current_time := (current_time::DATE + INTERVAL '1 day')::DATE + start_hour;
            CONTINUE;
        END IF;

        available_hours := EXTRACT(EPOCH FROM (end_hour - current_time::TIME)) / 3600;

        IF remaining_hours <= available_hours THEN
            current_time := current_time + (remaining_hours || ' hours')::INTERVAL;
            remaining_hours := 0;
        ELSE
            remaining_hours := remaining_hours - FLOOR(available_hours);
            current_time := (current_time::DATE + INTERVAL '1 day')::DATE + start_hour;
        END IF;
    END LOOP;

    RETURN current_time;
END;
$$ LANGUAGE plpgsql;

-- 7. RLS Implementation
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE transporters ENABLE ROW LEVEL SECURITY;
ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_checklist_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Assuming auth.uid() function exists via Supabase

-- Master Data Policies (Read: Auth, Write: MIS)
CREATE POLICY "Public read roles" ON roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Public read profiles" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Public read user roles" ON user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Public read workflow stages" ON workflow_stages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Public read holidays" ON holidays FOR SELECT TO authenticated USING (true);
CREATE POLICY "Public read customers" ON customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Public read customer addresses" ON customer_addresses FOR SELECT TO authenticated USING (true);

-- Orders (Read: Auth)
CREATE POLICY "Public read orders" ON orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Public read order stages" ON order_stages FOR SELECT TO authenticated USING (true);

-- Documents (Read: Auth, Insert: Auth)
CREATE POLICY "Public read documents" ON documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert documents" ON documents FOR INSERT TO authenticated WITH CHECK (auth.uid() = uploaded_by);

-- Invoices (Read: Auth)
CREATE POLICY "Public read invoices" ON invoices FOR SELECT TO authenticated USING (true);

-- Audit Logs (Read: Auth restricted, Write: None via UI)
CREATE POLICY "Restricted read audit logs" ON audit_logs FOR SELECT TO authenticated USING (true); 
-- In a real scenario with user_has_role, we would apply: USING (user_has_role('MIS'))

-- 8. Audit Trigger
CREATE OR REPLACE FUNCTION log_order_changes() RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_logs(order_id, action, old_state, new_state)
    VALUES (NEW.id, TG_OP, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_audit_orders
AFTER UPDATE ON orders
FOR EACH ROW EXECUTE FUNCTION log_order_changes();
