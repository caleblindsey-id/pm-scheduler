-- Migration 048: Equipment / Customers hardening (QC pass — section 6).
-- See projects/callboard-qc/section-6-equipment-customers-sync.md.
--
-- Three changes:
--   1. equipment_tech_field_lock — BEFORE UPDATE trigger blocks technicians
--      from writing any equipment column other than contact_*. Closes the P0
--      where the tech UPDATE policy was a blanket grant relying on client-
--      side filtering (EQ-1).
--   2. pm_schedules CHECK constraints — anchor_month BETWEEN 1 AND 12,
--      interval_months > 0. Prevents the calcNextServiceDate NaN/wrong-date
--      failure mode from corrupted data (EQ-11).
--   3. pm_tickets.show_pricing column + backfill — snapshots the customer's
--      show_pricing_on_pm_pdf flag onto the ticket at completion time so PDF
--      regeneration is stable (EQ-9). Backfills existing completed/billed
--      tickets from the customer's current value (best we can do for history).

-- ---------------------------------------------------------------------------
-- 1. Equipment tech-field lock (EQ-1)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION restrict_tech_equipment_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Only inspect tech updates. Other roles fall through unchanged.
  IF get_user_role() = 'technician' THEN
    IF NEW.customer_id           IS DISTINCT FROM OLD.customer_id           OR
       NEW.make                  IS DISTINCT FROM OLD.make                  OR
       NEW.model                 IS DISTINCT FROM OLD.model                 OR
       NEW.serial_number         IS DISTINCT FROM OLD.serial_number         OR
       NEW.description           IS DISTINCT FROM OLD.description           OR
       NEW.location_on_site      IS DISTINCT FROM OLD.location_on_site      OR
       NEW.default_technician_id IS DISTINCT FROM OLD.default_technician_id OR
       NEW.ship_to_location_id   IS DISTINCT FROM OLD.ship_to_location_id   OR
       NEW.default_products::text IS DISTINCT FROM OLD.default_products::text OR
       NEW.blanket_po_number     IS DISTINCT FROM OLD.blanket_po_number     OR
       NEW.active                IS DISTINCT FROM OLD.active
    THEN
      RAISE EXCEPTION 'Technicians may only update contact fields on equipment.'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS equipment_tech_field_lock ON equipment;
CREATE TRIGGER equipment_tech_field_lock
  BEFORE UPDATE ON equipment
  FOR EACH ROW
  EXECUTE FUNCTION restrict_tech_equipment_updates();

-- ---------------------------------------------------------------------------
-- 2. pm_schedules sanity CHECK constraints (EQ-11)
-- ---------------------------------------------------------------------------
ALTER TABLE pm_schedules
  DROP CONSTRAINT IF EXISTS pm_schedules_anchor_month_check;
ALTER TABLE pm_schedules
  ADD CONSTRAINT pm_schedules_anchor_month_check
  CHECK (anchor_month BETWEEN 1 AND 12);

ALTER TABLE pm_schedules
  DROP CONSTRAINT IF EXISTS pm_schedules_interval_months_check;
ALTER TABLE pm_schedules
  ADD CONSTRAINT pm_schedules_interval_months_check
  CHECK (interval_months > 0);

-- ---------------------------------------------------------------------------
-- 3. pm_tickets.show_pricing column (EQ-9)
-- ---------------------------------------------------------------------------
ALTER TABLE pm_tickets
  ADD COLUMN IF NOT EXISTS show_pricing BOOLEAN;

COMMENT ON COLUMN pm_tickets.show_pricing IS
  'Snapshot of customers.show_pricing_on_pm_pdf at completion time. PDF route reads from this column rather than the customer row, so toggling the customer flag does not retroactively change historical PDFs. NULL on incomplete tickets — falls back to customer flag for backwards-compat on legacy completed rows.';

-- Backfill existing completed/billed tickets with the current customer flag.
-- For pre-flag tickets this is the best historical snapshot we can produce.
UPDATE pm_tickets
SET show_pricing = customers.show_pricing_on_pm_pdf
FROM customers
WHERE pm_tickets.customer_id = customers.id
  AND pm_tickets.show_pricing IS NULL
  AND pm_tickets.status IN ('completed', 'billed');
