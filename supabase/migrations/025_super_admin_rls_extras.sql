-- equipment_prospects: add super_admin (missed in 024)
DROP POLICY IF EXISTS "Staff manage equipment_prospects" ON equipment_prospects;
CREATE POLICY "Staff manage equipment_prospects"
  ON equipment_prospects FOR ALL TO authenticated
  USING (get_user_role() IN ('super_admin','manager','coordinator'));

-- technician_targets: add super_admin (missed in 024)
DROP POLICY IF EXISTS "Staff manage technician_targets" ON technician_targets;
CREATE POLICY "Staff manage technician_targets"
  ON technician_targets FOR ALL TO authenticated
  USING (get_user_role() IN ('super_admin','manager','coordinator'));
