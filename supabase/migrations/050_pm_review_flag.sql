-- Migration 050: Flag newly-generated PMs for manager review when a prior-month
-- PM for the same equipment is still open (unassigned/assigned/in_progress).
--
-- Replaces the previous silent "auto-skip orphan unassigned" behavior in the
-- generation API. Manager now decides via Approve & Keep or Skip from the
-- ticket detail page or the /tickets?needsReview=1 queue.

ALTER TABLE pm_tickets
  ADD COLUMN IF NOT EXISTS requires_review BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS review_reason TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_by_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

-- Partial index keeps the manager dashboard count + queue page fast: only
-- flagged, non-deleted rows hit the index.
CREATE INDEX IF NOT EXISTS idx_pm_tickets_requires_review
  ON pm_tickets(requires_review)
  WHERE requires_review = TRUE AND deleted_at IS NULL;
