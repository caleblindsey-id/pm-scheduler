import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/auth'

const STAFF_ROLES = ['manager', 'coordinator', 'super_admin'] as const
const VALID_ACTIONS = ['approve', 'skip'] as const
type ReviewAction = typeof VALID_ACTIONS[number]

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = (await request.json()) as { action?: unknown; note?: unknown }

    const action = typeof body.action === 'string' ? body.action : ''
    if (!VALID_ACTIONS.includes(action as ReviewAction)) {
      return NextResponse.json(
        { error: 'action must be approve or skip' },
        { status: 400 }
      )
    }
    const note = typeof body.note === 'string' ? body.note.trim() : ''

    const user = await getCurrentUser()
    if (!user?.role) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!STAFF_ROLES.includes(user.role as typeof STAFF_ROLES[number])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const supabase = await createClient()

    const { data: ticket, error: ticketErr } = await supabase
      .from('pm_tickets')
      .select('id, requires_review, review_reason, deleted_at')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (ticketErr || !ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
    }
    if (!ticket.requires_review) {
      return NextResponse.json(
        { error: 'Ticket is not flagged for review' },
        { status: 422 }
      )
    }

    const nowIso = new Date().toISOString()

    if (action === 'approve') {
      const { data, error } = await supabase
        .from('pm_tickets')
        .update({
          requires_review: false,
          reviewed_by_id: user.id,
          reviewed_at: nowIso,
        })
        .eq('id', id)
        .eq('requires_review', true)
        .is('deleted_at', null)
        .select()
        .single()

      if (error || !data) {
        console.error('tickets/[id]/review approve error:', error)
        return NextResponse.json({ error: 'Failed to approve' }, { status: 500 })
      }
      return NextResponse.json({ ticket: data })
    }

    // Skip: roll the ticket to skipped with a reason that preserves the
    // original review_reason and any optional manager note.
    const baseReason = ticket.review_reason ?? 'Prior PM still open'
    const skipReason = note ? `Reviewed: ${baseReason} — ${note}` : `Reviewed: ${baseReason}`

    const { data, error } = await supabase
      .from('pm_tickets')
      .update({
        status: 'skipped',
        skip_reason: skipReason,
        requires_review: false,
        reviewed_by_id: user.id,
        reviewed_at: nowIso,
      })
      .eq('id', id)
      .eq('requires_review', true)
      .is('deleted_at', null)
      .select()
      .single()

    if (error || !data) {
      console.error('tickets/[id]/review skip error:', error)
      return NextResponse.json({ error: 'Failed to skip' }, { status: 500 })
    }
    return NextResponse.json({ ticket: data })
  } catch (err) {
    console.error('tickets/[id]/review POST error:', err)
    return NextResponse.json({ error: 'Failed to process review' }, { status: 500 })
  }
}
