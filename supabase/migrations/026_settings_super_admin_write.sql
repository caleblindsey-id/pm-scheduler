-- Allow super_admin to write settings (was only manager/coordinator)
DROP POLICY IF EXISTS "Managers can update settings" ON settings;
CREATE POLICY "Managers can update settings"
  ON settings FOR ALL
  TO authenticated
  USING (get_user_role() IN ('super_admin','manager','coordinator'));
