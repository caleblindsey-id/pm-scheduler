import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { updateTicket } from '@/lib/db/tickets'
import { PmTicketRow, TicketStatus } from '@/types/database'

// Only allow these fields to be updated via PATCH
const ALLOWED_FIELDS = [
  'assigned_technician_id',
  'status',
  'scheduled_date',
  'completion_notes',
  'hours_worked',
  'parts_used',
  'billing_amount',
] as const

type AllowedUpdate = Pick<PmTicketRow, typeof ALLOWED_FIELDS[number]>

// Valid forward-only state transitions
const VALID_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  unassigned: ['assigned', 'in_progress'],
  assigned:   ['in_progress', 'unassigned'],
  in_progress: ['completed'],
  completed:  ['billed'],
  billed:     [],
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const raw = await request.json()

    const filtered = Object.fromEntries(
      Object.entries(raw).filter(([key]) => (ALLOWED_FIELDS as readonly string[]).includes(key))
    ) as Partial<AllowedUpdate>

    if (Object.keys(filtered).length === 0) {
      return NextResponse.json(
        { error: 'No recognized fields in request body' },
        { status: 400 }
      )
    }

    // If a status transition is requested, validate it against the state machine
    if (filtered.status !== undefined) {
      const supabase = await createClient()
      const { data: current, error: fetchError } = await supabase
        .from('pm_tickets')
        .select('status')
        .eq('id', id)
        .single()

      if (fetchError || !current) {
        return NextResponse.json({ error: 'Ticket not found' }, { status: 404 })
      }

      const currentStatus = current.status as TicketStatus
      const nextStatus = filtered.status as TicketStatus
      const allowed = VALID_TRANSITIONS[currentStatus] ?? []

      if (!allowed.includes(nextStatus)) {
        return NextResponse.json(
          { error: `Invalid status transition: ${currentStatus} → ${nextStatus}` },
          { status: 409 }
        )
      }
    }

    const updated = await updateTicket(id, filtered)

    return NextResponse.json(updated)
  } catch (err) {
    console.error(`tickets/[id] PATCH error:`, err)
    return NextResponse.json(
      { error: 'Failed to update ticket' },
      { status: 500 }
    )
  }
}
