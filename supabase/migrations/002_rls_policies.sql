-- Enable RLS on all PM-owned tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE pm_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_log ENABLE ROW LEVEL SECURITY;
-- Synced tables are read-only for all authenticated users
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Helper: get the current user's role from our users table
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- CUSTOMERS: all authenticated users can read
CREATE POLICY "Authenticated read customers"
  ON customers FOR SELECT TO authenticated USING (true);

-- CONTACTS: all authenticated users can read
CREATE POLICY "Authenticated read contacts"
  ON contacts FOR SELECT TO authenticated USING (true);

-- PRODUCTS: all authenticated users can read
CREATE POLICY "Authenticated read products"
  ON products FOR SELECT TO authenticated USING (true);

-- SYNC_LOG: managers and coordinators can read
CREATE POLICY "Staff read sync_log"
  ON sync_log FOR SELECT TO authenticated
  USING (get_user_role() IN ('manager','coordinator'));

-- USERS: managers can manage all; others can read active users
CREATE POLICY "Managers manage users"
  ON users FOR ALL TO authenticated
  USING (get_user_role() = 'manager');
CREATE POLICY "Staff read users"
  ON users FOR SELECT TO authenticated
  USING (get_user_role() IN ('coordinator','technician'));

-- EQUIPMENT: managers/coordinators can manage; techs can read
CREATE POLICY "Staff manage equipment"
  ON equipment FOR ALL TO authenticated
  USING (get_user_role() IN ('manager','coordinator'));
CREATE POLICY "Technicians read equipment"
  ON equipment FOR SELECT TO authenticated
  USING (get_user_role() = 'technician');

-- PM_SCHEDULES: managers/coordinators can manage; techs can read
CREATE POLICY "Staff manage schedules"
  ON pm_schedules FOR ALL TO authenticated
  USING (get_user_role() IN ('manager','coordinator'));
CREATE POLICY "Technicians read schedules"
  ON pm_schedules FOR SELECT TO authenticated
  USING (get_user_role() = 'technician');

-- PM_TICKETS: managers/coordinators see all; techs see only assigned
CREATE POLICY "Staff manage tickets"
  ON pm_tickets FOR ALL TO authenticated
  USING (get_user_role() IN ('manager','coordinator'));
CREATE POLICY "Technicians see own tickets"
  ON pm_tickets FOR SELECT TO authenticated
  USING (
    get_user_role() = 'technician'
    AND assigned_technician_id = auth.uid()
  );
CREATE POLICY "Technicians update own tickets"
  ON pm_tickets FOR UPDATE TO authenticated
  USING (
    get_user_role() = 'technician'
    AND assigned_technician_id = auth.uid()
  );
