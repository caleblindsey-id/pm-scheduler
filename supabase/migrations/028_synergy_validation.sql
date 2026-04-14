-- Migration 028: Synergy order number validation columns
-- Used by the nightly validate-synergy-orders.py script to flag
-- order numbers that don't exist in Synergy's roh table.

ALTER TABLE service_tickets
  ADD COLUMN synergy_validated_at TIMESTAMPTZ,
  ADD COLUMN synergy_validation_status TEXT
    CHECK (synergy_validation_status IN ('valid', 'invalid', 'pending'))
    DEFAULT 'pending';
