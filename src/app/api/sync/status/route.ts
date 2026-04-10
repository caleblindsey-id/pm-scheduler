import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser, MANAGER_ROLES } from '@/lib/auth'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user?.role || !MANAGER_ROLES.includes(user.role)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = await createClient()

    const { data, error } = await supabase
      .from('sync_log')
      .select('id, sync_type, started_at, completed_at, records_synced, status, error_message')
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw error

    if (!data) {
      return NextResponse.json({ status: 'never_run', started_at: null, completed_at: null, records_synced: null, error_message: null })
    }

    return NextResponse.json({ last_sync: data })
  } catch (err) {
    console.error('sync/status error:', err)
    return NextResponse.json(
      { error: 'Failed to fetch sync status' },
      { status: 500 }
    )
  }
}
