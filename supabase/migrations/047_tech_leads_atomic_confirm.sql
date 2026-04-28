-- Migration 047: Atomic confirm-match Postgres function (TL-1) +
-- lock-paid-fields trigger (TL-7) + tighter partial unique index (TL-4).
--
-- All three are tech_leads correctness/safety improvements caught by the
-- Section 5 QC review.
--   - confirm_match_candidate(): wraps the candidate-confirm + sibling-dismiss
--     + lead-earn flow in a single transaction so partial failures don't leave
--     the DB in an inconsistent state, and concurrent calls properly race-lose
--     instead of double-earning.
--   - lock_paid_lead_fields(): BEFORE UPDATE trigger preventing rewrites of
--     bonus_amount / earned_at / paid_at / paid_by / payout_period on already-
--     earned or paid leads. Last line of defense if a future API bug or
--     direct supabase-js call tries to modify these.
--   - tighter idx_tech_leads_equipment_unique: partial unique index now
--     excludes cancelled/rejected/expired leads, so terminating a lead
--     releases the equipment slot for a future lead to claim.
--
-- See projects/callboard-qc/section-5-tech-leads.md.

-- ---------------------------------------------------------------------------
-- 1. Atomic confirm-match function (TL-1)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION confirm_match_candidate(
  p_lead_id UUID,
  p_candidate_id UUID,
  p_tier TEXT,
  p_bonus_amount NUMERIC,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_synergy_order_number TEXT;
  v_now TIMESTAMPTZ := now();
  v_rows INT;
BEGIN
  -- 1. Confirm the candidate. Compare-and-swap on status='pending'.
  UPDATE equipment_sale_lead_candidates
  SET status = 'confirmed', reviewed_by = p_user_id, reviewed_at = v_now
  WHERE id = p_candidate_id
    AND tech_lead_id = p_lead_id
    AND status = 'pending'
  RETURNING synergy_order_number INTO v_synergy_order_number;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RAISE EXCEPTION 'Candidate not pending or does not belong to this lead'
      USING ERRCODE = 'P0001';
  END IF;

  -- 2. Dismiss any sibling pending candidates on this lead.
  UPDATE equipment_sale_lead_candidates
  SET status = 'dismissed', reviewed_by = p_user_id, reviewed_at = v_now
  WHERE tech_lead_id = p_lead_id
    AND status = 'pending'
    AND id <> p_candidate_id;

  -- 3. Earn the lead — but only if it's still in an earnable state.
  --    This is the second compare-and-swap: races where another manager
  --    already earned this lead via a different candidate fail here.
  UPDATE tech_leads
  SET status = 'earned',
      sale_equipment_tier = p_tier,
      sale_synergy_order_number = v_synergy_order_number,
      bonus_amount = p_bonus_amount,
      earned_at = v_now
  WHERE id = p_lead_id
    AND lead_type = 'equipment_sale'
    AND status IN ('approved', 'match_pending');

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RAISE EXCEPTION 'Lead is no longer in an earnable state'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'bonus_amount', p_bonus_amount,
    'synergy_order_number', v_synergy_order_number
  );
END;
$$;

-- Restrict function execution to authenticated users (the API route already
-- enforces RESET_ROLES; this is defense-in-depth).
REVOKE ALL ON FUNCTION confirm_match_candidate(UUID, UUID, TEXT, NUMERIC, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION confirm_match_candidate(UUID, UUID, TEXT, NUMERIC, UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. BEFORE UPDATE trigger to lock paid-field rewrites (TL-7)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION lock_paid_lead_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status IN ('earned', 'paid') AND (
    NEW.bonus_amount IS DISTINCT FROM OLD.bonus_amount OR
    NEW.earned_at   IS DISTINCT FROM OLD.earned_at  OR
    NEW.paid_at     IS DISTINCT FROM OLD.paid_at    OR
    NEW.paid_by     IS DISTINCT FROM OLD.paid_by    OR
    NEW.payout_period IS DISTINCT FROM OLD.payout_period
  ) AND
    -- Allow the legitimate earned -> paid transition (status flip writes
    -- paid_at/paid_by/payout_period as part of the same UPDATE).
    NOT (OLD.status = 'earned' AND NEW.status = 'paid')
  THEN
    RAISE EXCEPTION 'Earn / payout fields cannot be modified once a lead is earned or paid'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tech_leads_lock_paid_fields ON tech_leads;
CREATE TRIGGER tech_leads_lock_paid_fields
  BEFORE UPDATE ON tech_leads
  FOR EACH ROW
  EXECUTE FUNCTION lock_paid_lead_fields();

-- ---------------------------------------------------------------------------
-- 3. Tighten partial unique index on equipment_id (TL-4)
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS idx_tech_leads_equipment_unique;
CREATE UNIQUE INDEX idx_tech_leads_equipment_unique
  ON tech_leads(equipment_id)
  WHERE equipment_id IS NOT NULL
    AND status NOT IN ('cancelled', 'rejected', 'expired');
