-- Add parts tracking to PM tickets (mirrors service_tickets.parts_requested workflow)
ALTER TABLE pm_tickets
  ADD COLUMN parts_requested JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN synergy_order_number VARCHAR;
