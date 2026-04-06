-- Prospect tracking for inactive equipment
CREATE TABLE equipment_prospects (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id  UUID NOT NULL UNIQUE REFERENCES equipment(id) ON DELETE CASCADE,
  is_prospect   BOOLEAN NOT NULL DEFAULT false,
  removed       BOOLEAN NOT NULL DEFAULT false,
  removal_reason TEXT,
  removal_note  TEXT,
  removed_at    TIMESTAMPTZ,
  removed_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_equipment_prospects_equipment_id ON equipment_prospects(equipment_id);

ALTER TABLE equipment_prospects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage equipment_prospects"
  ON equipment_prospects FOR ALL TO authenticated
  USING (get_user_role() IN ('manager','coordinator'));
