-- Migration 00006_tasks_and_notifications.sql

-- 1. Teams Configuration
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS team_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    UNIQUE(team_id, user_id)
);

-- 2. Tasks Management
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    stage_id UUID REFERENCES workflow_stages(id) ON DELETE CASCADE,
    order_stage_id UUID REFERENCES order_stages(id) ON DELETE CASCADE,
    step TEXT,
    assigned_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    assigned_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'In Progress', 'Completed', 'Cancelled')),
    priority TEXT DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent')),
    planned_at TIMESTAMPTZ DEFAULT NOW(),
    due_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    completed_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    remarks TEXT
);

CREATE INDEX idx_tasks_user ON tasks(assigned_user_id);
CREATE INDEX idx_tasks_team ON tasks(assigned_team_id);
CREATE INDEX idx_tasks_status ON tasks(status);

-- 3. Workflow Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    reference_id UUID, -- Optional link to an order or task
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CHECK (user_id IS NOT NULL OR team_id IS NOT NULL)
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_team ON notifications(team_id);
CREATE INDEX idx_notifications_unread ON notifications(is_read) WHERE is_read = false;

-- 4. Enable Realtime on Notifications
-- We assume supabase_realtime publication exists standard in Supabase
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- 5. RLS Policies
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY ""Public read teams"" ON teams FOR SELECT TO authenticated USING (true);
CREATE POLICY ""Public read team members"" ON team_members FOR SELECT TO authenticated USING (true);

-- Tasks Visibility: Users can see tasks assigned to them, their team, or if they are Admin/MIS
CREATE POLICY ""Auth read tasks"" ON tasks FOR SELECT TO authenticated USING (
    assigned_user_id = auth.uid() OR
    assigned_team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()) OR
    public.user_has_role('Admin') OR public.user_has_role('MIS')
);

CREATE POLICY ""Auth update tasks"" ON tasks FOR UPDATE TO authenticated USING (
    assigned_user_id = auth.uid() OR
    assigned_team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()) OR
    public.user_has_role('Admin') OR public.user_has_role('MIS')
);

-- Notifications Visibility: Only see your own or your team's notifications
CREATE POLICY ""Auth read notifications"" ON notifications FOR SELECT TO authenticated USING (
    user_id = auth.uid() OR
    team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
);

CREATE POLICY ""Auth update notifications"" ON notifications FOR UPDATE TO authenticated USING (
    user_id = auth.uid() OR
    team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid())
);

-- 6. Trigger for New Task Notification
CREATE OR REPLACE FUNCTION notify_new_task() RETURNS TRIGGER AS $$$
BEGIN
    INSERT INTO notifications(user_id, team_id, type, message, reference_id)
    VALUES (
        NEW.assigned_user_id, 
        NEW.assigned_team_id, 
        'NEW_TASK', 
        'New task assigned: ' || COALESCE(NEW.step, 'Workflow Stage Task'), 
        NEW.order_id
    );
    RETURN NEW;
END;
$$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_notify_task
AFTER INSERT ON tasks
FOR EACH ROW EXECUTE FUNCTION notify_new_task();
