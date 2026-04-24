-- Migration 040: Service Tickets — Ship-To Location
-- Adds a nullable reference to ship_to_locations on service_tickets.
-- Service address snapshot columns remain authoritative for PDFs/reporting;
-- the new FK is for selection + filtering (e.g. equipment list narrows to ship-to).

ALTER TABLE service_tickets
  ADD COLUMN ship_to_location_id INTEGER,
  ADD CONSTRAINT service_tickets_ship_to_location_id_fkey
    FOREIGN KEY (ship_to_location_id) REFERENCES ship_to_locations(id) ON DELETE SET NULL;

CREATE INDEX idx_service_tickets_ship_to_location ON service_tickets(ship_to_location_id);
