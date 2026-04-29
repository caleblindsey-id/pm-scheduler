-- Migration 054: Manual decision note on staff approve/decline overrides
--
-- When staff manually approve or decline an estimate (bypassing the customer's
-- public /approve/[token] flow), they're now required to leave a note
-- explaining who told us to approve/reject — phone call, email, in-person,
-- whatever. This column stores that free-text note. Nullable for legacy
-- tickets that pre-date the requirement; new manual decisions enforce it via
-- server-side validation in the PATCH route.

ALTER TABLE service_tickets
  ADD COLUMN IF NOT EXISTS manual_decision_note TEXT;

ALTER TABLE service_tickets
  DROP CONSTRAINT IF EXISTS service_tickets_manual_decision_note_len;

ALTER TABLE service_tickets
  ADD CONSTRAINT service_tickets_manual_decision_note_len
    CHECK (manual_decision_note IS NULL OR char_length(manual_decision_note) <= 2000);
