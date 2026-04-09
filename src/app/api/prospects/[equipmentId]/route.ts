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

  const { error } = await supabase
    .from('equipment_prospects')
    .upsert(
      { equipment_id: equipmentId, is_prospect: true, removed: false },
      { onConflict: 'equipment_id' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
