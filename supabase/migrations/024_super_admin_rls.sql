-- Add super_admin to the role CHECK constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('super_admin','manager','coordinator','technician'));

-- SYNC_LOG: add super_admin
DROP POLICY IF EXISTS "Staff read sync_log" ON sync_log;
CREATE POLICY "Staff read sync_log"
  ON sync_log FOR SELECT TO authenticated
  USING (get_user_role() IN ('super_admin','manager','coordinator'));

-- USERS: super_admin and manager can manage all
DROP POLICY IF EXISTS "Managers manage users" ON users;
CREATE POLICY "Managers manage users"
  ON users FOR ALL TO authenticated
  USING (get_user_role() IN ('super_admin','manager'));

-- EQUIPMENT: add super_admin
DROP POLICY IF EXISTS "Staff manage equipment" ON equipment;
CREATE POLICY "Staff manage equipment"
  ON equipment FOR ALL TO authenticated
  USING (get_user_role() IN ('super_admin','manager','coordinator'));

-- PM_SCHEDULES: add super_admin
DROP POLICY IF EXISTS "Staff manage schedules" ON pm_schedules;
CREATE POLICY "Staff manage schedules"
  ON pm_schedules FOR ALL TO authenticated
  USING (get_user_role() IN ('super_admin','manager','coordinator'));

-- PM_TICKETS: add super_admin
DROP POLICY IF EXISTS "Staff manage tickets" ON pm_tickets;
CREATE POLICY "Staff manage tickets"
  ON pm_tickets FOR ALL TO authenticated
  USING (get_user_role() IN ('super_admin','manager','coordinator'));
