import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser, RESET_ROLES } from '@/lib/auth'
import type { EquipmentSaleTier } from '@/types/database'
import { EQUIPMENT_SALE_TIERS } from '@/lib/tech-leads/bonus-tiers'

type Body = {
  tier: EquipmentSaleTier
}

// POST /api/tech-leads/[id]/candidates/[candidateId]/confirm
//
// Wraps the candidate-confirm + sibling-dismiss + lead-earn flow in a single
// Postgres function (confirm_match_candidate, migration 047) so all three
// writes are atomic. Two managers clicking concurrently can no longer double-
// earn or leave the DB in a half-applied state.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; candidateId: string }> }
) {
  const { id, candidateId } = await params
  try {
    const user = await getCurrentUser()
    if (!user?.role) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!RESET_ROLES.includes(user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { tier } = (await request.json()) as Body
    if (!tier || !(tier in EQUIPMENT_SALE_TIERS)) {
      return NextResponse.json({ error: 'A valid tier is required.' }, { status: 400 })
    }
    const bonus = EQUIPMENT_SALE_TIERS[tier].amount

    const supabase = await createClient()
    // The Supabase generated types don't yet include this function (added in
    // migration 047). Cast the rpc call to keep the type checker quiet —
    // we'll regenerate types later.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)('confirm_match_candidate', {
      p_lead_id: id,
      p_candidate_id: candidateId,
      p_tier: tier,
      p_bonus_amount: bonus,
      p_user_id: user.id,
    })

    if (error) {
      // P0001 is the explicit raise from the function — race lost or invalid state.
      const code = (error as { code?: string }).code
      if (code === 'P0001') {
        return NextResponse.json(
          { error: error.message || 'Candidate or lead is no longer in a confirmable state.' },
          { status: 409 }
        )
      }
      console.error('confirm RPC error:', error)
      return NextResponse.json({ error: 'Failed to confirm match.' }, { status: 500 })
    }

    return NextResponse.json({ success: true, bonus_amount: bonus, result: data })
  } catch (err) {
    console.error('confirm POST error:', err)
    return NextResponse.json({ error: 'Failed to confirm match.' }, { status: 500 })
  }
}
