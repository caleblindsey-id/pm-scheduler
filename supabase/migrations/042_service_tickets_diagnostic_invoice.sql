-- Migration 042: Service Tickets — Diagnostic Invoice Number
-- diagnostic_charge already exists; the diagnostic fee is often billed on a
-- separate Synergy invoice before the repair ticket is opened. Capture that
-- invoice number alongside the amount so billing / summary views can reference
-- where the diagnostic was charged.

ALTER TABLE service_tickets
  ADD COLUMN diagnostic_invoice_number VARCHAR;
