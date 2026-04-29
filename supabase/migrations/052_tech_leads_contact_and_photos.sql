-- Migration 052: Tech leads — lead contact + machine photos
--
-- Adds three contact columns and a photos JSONB array to tech_leads so techs
-- can capture a contact person and machine photos at lead-submission time.
--
-- Photo paths in the shared `ticket-photos` bucket are namespaced as
-- `leads/{tech_lead_id}/{uuid}.jpg`. The existing storage RLS (migration 045)
-- only matches the first folder segment against pm_tickets / service_tickets
-- UUIDs, so we drop and recreate the four ticket_photos_* policies with an
-- additional `leads/` branch that ties permission to tech_leads visibility.

-- ============================================================
-- 1. Schema changes
-- ============================================================

ALTER TABLE tech_leads
  ADD COLUMN IF NOT EXISTS contact_name  TEXT,
  ADD COLUMN IF NOT EXISTS contact_email TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS photos        JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Soft length caps mirroring the API-side limits.
ALTER TABLE tech_leads
  DROP CONSTRAINT IF EXISTS tech_leads_contact_name_len,
  DROP CONSTRAINT IF EXISTS tech_leads_contact_email_len,
  DROP CONSTRAINT IF EXISTS tech_leads_contact_phone_len;

ALTER TABLE tech_leads
  ADD CONSTRAINT tech_leads_contact_name_len  CHECK (contact_name  IS NULL OR char_length(contact_name)  <= 200),
  ADD CONSTRAINT tech_leads_contact_email_len CHECK (contact_email IS NULL OR char_length(contact_email) <= 320),
  ADD CONSTRAINT tech_leads_contact_phone_len CHECK (contact_phone IS NULL OR char_length(contact_phone) <= 40);

-- ============================================================
-- 2. Storage RLS — extend ticket-photos policies for `leads/{id}/`
-- ============================================================

DROP POLICY IF EXISTS "ticket_photos_insert" ON storage.objects;
DROP POLICY IF EXISTS "ticket_photos_select" ON storage.objects;
DROP POLICY IF EXISTS "ticket_photos_delete" ON storage.objects;
DROP POLICY IF EXISTS "ticket_photos_update" ON storage.objects;

CREATE POLICY "ticket_photos_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'ticket-photos'
    AND (
      EXISTS (SELECT 1 FROM public.pm_tickets WHERE id::text = (storage.foldername(name))[1])
      OR EXISTS (SELECT 1 FROM public.service_tickets WHERE id::text = (storage.foldername(name))[1])
      OR (
        (storage.foldername(name))[1] = 'leads'
        AND EXISTS (SELECT 1 FROM public.tech_leads WHERE id::text = (storage.foldername(name))[2])
      )
    )
  );

CREATE POLICY "ticket_photos_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'ticket-photos'
    AND (
      EXISTS (SELECT 1 FROM public.pm_tickets WHERE id::text = (storage.foldername(name))[1])
      OR EXISTS (SELECT 1 FROM public.service_tickets WHERE id::text = (storage.foldername(name))[1])
      OR (
        (storage.foldername(name))[1] = 'leads'
        AND EXISTS (SELECT 1 FROM public.tech_leads WHERE id::text = (storage.foldername(name))[2])
      )
    )
  );

CREATE POLICY "ticket_photos_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'ticket-photos'
    AND (
      EXISTS (SELECT 1 FROM public.pm_tickets WHERE id::text = (storage.foldername(name))[1])
      OR EXISTS (SELECT 1 FROM public.service_tickets WHERE id::text = (storage.foldername(name))[1])
      OR (
        (storage.foldername(name))[1] = 'leads'
        AND EXISTS (SELECT 1 FROM public.tech_leads WHERE id::text = (storage.foldername(name))[2])
      )
    )
  );

CREATE POLICY "ticket_photos_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'ticket-photos'
    AND (
      EXISTS (SELECT 1 FROM public.pm_tickets WHERE id::text = (storage.foldername(name))[1])
      OR EXISTS (SELECT 1 FROM public.service_tickets WHERE id::text = (storage.foldername(name))[1])
      OR (
        (storage.foldername(name))[1] = 'leads'
        AND EXISTS (SELECT 1 FROM public.tech_leads WHERE id::text = (storage.foldername(name))[2])
      )
    )
  )
  WITH CHECK (
    bucket_id = 'ticket-photos'
    AND (
      EXISTS (SELECT 1 FROM public.pm_tickets WHERE id::text = (storage.foldername(name))[1])
      OR EXISTS (SELECT 1 FROM public.service_tickets WHERE id::text = (storage.foldername(name))[1])
      OR (
        (storage.foldername(name))[1] = 'leads'
        AND EXISTS (SELECT 1 FROM public.tech_leads WHERE id::text = (storage.foldername(name))[2])
      )
    )
  );
