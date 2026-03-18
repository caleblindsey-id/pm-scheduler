-- ============================================================
-- PM Scheduler — Phase 1 Fixes
-- ============================================================

-- ============================================================
-- Critical Fix 1: get_user_role() security hardening
-- ============================================================

-- Fix SECURITY DEFINER search_path vulnerability
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp;

-- Bootstrap policy: allow authenticated users to INSERT into users if no manager exists yet
-- This lets the first manager account be created
CREATE POLICY "Bootstrap first manager"
  ON users FOR INSERT TO authenticated
  WITH CHECK (
    NOT EXISTS (SELECT 1 FROM public.users WHERE role = 'manager')
    OR get_user_role() = 'manager'
  );

-- ============================================================
-- Critical Fix 2: Unique constraint to prevent duplicate tickets
-- ============================================================

ALTER TABLE pm_tickets
  ADD CONSTRAINT uq_ticket_schedule_month_year
  UNIQUE (pm_schedule_id, month, year);

-- ============================================================
-- Important Fix 3: contacts — synergy_id unique index (partial, non-null)
-- ============================================================

-- synergy_id unique on contacts (when not null)
CREATE UNIQUE INDEX idx_contacts_synergy_id ON contacts(synergy_id) WHERE synergy_id IS NOT NULL;
-- Note: customer_id nullable is intentional for contacts not yet matched to a customer

-- ============================================================
-- Important Fix 4: updated_at auto-update triggers
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER equipment_updated_at
  BEFORE UPDATE ON equipment
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Also apply to pm_tickets
CREATE TRIGGER pm_tickets_updated_at
  BEFORE UPDATE ON pm_tickets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- Minor Fix 5: sync_log.started_at DEFAULT
-- ============================================================

ALTER TABLE sync_log ALTER COLUMN started_at SET DEFAULT now();

-- ============================================================
-- Minor Fix 6: contacts customer_id index
-- ============================================================

CREATE INDEX idx_contacts_customer ON contacts(customer_id);
