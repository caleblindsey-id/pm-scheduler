-- Migration 053: Email send tracking + email branding settings
--
-- Adds the per-ticket fields needed to track when an estimate-approval email
-- went out via Mandrill (Mailchimp Transactional) and the per-recipient
-- message id Mandrill returns, plus seeds the settings rows used by the email
-- template for branding (from address, company name, support phone).
--
-- The settings rows are seeded with sensible defaults; final values for
-- email_from_address get set during Mandrill verification (Phase 0 of the
-- rollout). ON CONFLICT DO NOTHING keeps existing rows intact if any were
-- pre-populated.

-- ============================================================
-- 1. Schema changes — service_tickets
-- ============================================================

ALTER TABLE service_tickets
  ADD COLUMN IF NOT EXISTS estimate_emailed_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS estimate_email_message_id  TEXT;

ALTER TABLE service_tickets
  DROP CONSTRAINT IF EXISTS service_tickets_estimate_email_message_id_len;

ALTER TABLE service_tickets
  ADD CONSTRAINT service_tickets_estimate_email_message_id_len
    CHECK (estimate_email_message_id IS NULL OR char_length(estimate_email_message_id) <= 128);

-- ============================================================
-- 2. Settings seeds — branding for transactional email
-- ============================================================
--
-- email_from_address must match a domain verified in Mandrill (SPF + DKIM).
-- Update this row after Phase 0 verification.

INSERT INTO settings (key, value) VALUES
  ('email_from_address', 'no-reply@example.com'),
  ('email_from_name',    'CallBoard'),
  ('company_name',       'Imperial Dade'),
  ('support_phone',      '')
ON CONFLICT (key) DO NOTHING;
