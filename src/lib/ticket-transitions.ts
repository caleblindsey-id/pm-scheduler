import type { PmTicketUpdate, TicketStatus } from '@/types/database'

// Forward-only state transitions for PM tickets. Single source of truth used by
// both the PATCH route and the manager-override UI in TicketActions.
//
// Note: completion goes through POST /api/tickets/[id]/complete, not PATCH.
// The PATCH route rejects status='completed' with a 422 so billing math,
// signature, machine_hours, and date_code requirements all run.
export const VALID_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  unassigned:     ['assigned', 'in_progress', 'skipped'],
  assigned:       ['in_progress', 'unassigned', 'skipped', 'skip_requested'],
  in_progress:    ['completed', 'assigned', 'unassigned', 'skip_requested'],
  completed:      ['billed', 'in_progress'],
  billed:         ['completed', 'in_progress', 'assigned', 'unassigned'],
  skipped:        ['unassigned'],
  skip_requested: ['skipped', 'in_progress', 'assigned'],
}

// Field set cleared whenever a ticket is reverted from a completed/in-progress state.
// Reused across the reopen branch and the manager-reset branch in PATCH /api/tickets/[id]
// so the two paths can never drift when a new completion field is added.
// parts_used / photos / additional_parts_used are typed non-null so we use [] (semantically empty).
export const EMPTY_COMPLETION_FIELDS: PmTicketUpdate = {
  completed_date: null,
  completion_notes: null,
  hours_worked: null,
  parts_used: [],
  billing_amount: null,
  customer_signature: null,
  customer_signature_name: null,
  photos: [],
  additional_parts_used: [],
  additional_hours_worked: null,
  machine_hours: null,
  date_code: null,
  show_pricing: null,
}
