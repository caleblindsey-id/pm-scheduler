import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

const ALLOWED_REASONS = [
  'Equipment no longer in operation',
  'Customer lost',
  'Replaced by new equipment',
  'Other',
]

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ equipmentId: string }> }
) {
  const user = await getCurrentUser()
  if (!user?.role || !['manager', 'coordinator'].includes(user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { equipmentId } = await params
  const body = await request.json()
  const { reason, note } = body

  if (!reason || !ALLOWED_REASONS.includes(reason)) {
    return NextResponse.json({ error: 'Valid removal reason is required' }, { status: 400 })
  }

  const supabase = await createClient()

  const { error } = await supabase
    .from('equipment_prospects')
    .upsert(
      {
        equipment_id: equipmentId,
        is_prospect: false,
        removed: true,
        removal_reason: reason,
        removal_note: note?.trim() || null,
        removed_at: new Date().toISOString(),
        removed_by: user.id,
      },
      { onConflict: 'equipment_id' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
