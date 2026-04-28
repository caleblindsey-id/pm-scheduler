import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser, MANAGER_ROLES } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ equipmentId: string }> }
) {
  const user = await getCurrentUser()
  if (!user?.role || !MANAGER_ROLES.includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { equipmentId } = await params
  const supabase = await createClient()

  // Preserve existing removal-audit fields (removed_at / removed_by /
  // removal_reason / removal_note) when re-prospecting an equipment row
  // that was previously removed. Without this, an unintended click would
  // wipe out the original removal evidence.
  const { data: existing } = await supabase
    .from('equipment_prospects')
    .select('removed, removed_at, removed_by, removal_reason, removal_note')
    .eq('equipment_id', equipmentId)
    .maybeSingle()

  // Keep the audit trail of any prior removal so re-prospecting doesn't
  // wipe out evidence of the previous removal.
  const upsertPayload = {
    equipment_id: equipmentId,
    is_prospect: true,
    removed: false,
    removal_reason: existing?.removed ? existing.removal_reason ?? null : null,
    removal_note: existing?.removed ? existing.removal_note ?? null : null,
    removed_at: existing?.removed ? existing.removed_at ?? null : null,
    removed_by: existing?.removed ? existing.removed_by ?? null : null,
  }

  const { error } = await supabase
    .from('equipment_prospects')
    .upsert(upsertPayload, { onConflict: 'equipment_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
