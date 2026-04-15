-- Add itemized estimate columns to service_tickets
-- estimate_amount stays as server-computed total (labor + parts)
-- estimate_labor_rate snapshots the system rate at estimate time

ALTER TABLE service_tickets
  ADD COLUMN estimate_labor_hours DECIMAL(5,2),
  ADD COLUMN estimate_labor_rate  DECIMAL(10,2),
  ADD COLUMN estimate_parts       JSONB DEFAULT '[]'::jsonb;
