import { createClient } from '@/lib/supabase/server'
import { EquipmentRow, EquipmentInsert, EquipmentProspectRow, PmScheduleRow, PmTicketRow } from '@/types/database'

export type EquipmentWithCustomer = EquipmentRow & {
  customers: { name: string } | null
  pm_schedules: { interval_months: number; anchor_month: number; active: boolean }[]
}

export type EquipmentDetail = EquipmentRow & {
  customers: { name: string } | null
  pm_schedules: PmScheduleRow[]
  pm_tickets: PmTicketRow[]
}

export async function getEquipment(filters?: {
  customerId?: number
  active?: boolean
}): Promise<EquipmentWithCustomer[]> {
  const supabase = await createClient()

  let query = supabase
    .from('equipment')
    .select('*, customers(name), pm_schedules(interval_months, anchor_month, active)')
    .order('created_at', { ascending: false })

  if (filters?.customerId !== undefined) {
    query = query.eq('customer_id', filters.customerId)
  }

  if (filters?.active !== undefined) {
    query = query.eq('active', filters.active)
  }

  const { data, error } = await query

  if (error) throw error
  return data as EquipmentWithCustomer[]
}

export async function getEquipmentByCustomer(customerId: number): Promise<EquipmentRow[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('equipment')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function getEquipmentDetail(id: string): Promise<EquipmentDetail | null> {
  const supabase = await createClient()

  // Fetch equipment with schedules first
  const { data: equipmentData, error: equipmentError } = await supabase
    .from('equipment')
    .select(`
      *,
      customers(name),
      pm_schedules(*)
    `)
    .eq('id', id)
    .single()

  if (equipmentError) {
    if (equipmentError.code === 'PGRST116') return null
    throw equipmentError
  }

  // Fetch the last 12 tickets separately to avoid nested limit syntax issues
  const { data: tickets, error: ticketsError } = await supabase
    .from('pm_tickets')
    .select('*')
    .eq('equipment_id', id)
    .order('created_at', { ascending: false })
    .limit(12)

  if (ticketsError) throw ticketsError

  return {
    ...(equipmentData as Record<string, unknown>),
    pm_tickets: tickets ?? [],
  } as unknown as EquipmentDetail
}

export async function getEquipmentServiceHistory(
  equipmentId: string,
  excludeTicketId?: string
): Promise<PmTicketRow[]> {
  const supabase = await createClient()

  let query = supabase
    .from('pm_tickets')
    .select('*')
    .eq('equipment_id', equipmentId)
    .in('status', ['completed', 'billed'])
    .order('completed_date', { ascending: false })

  if (excludeTicketId) {
    query = query.neq('id', excludeTicketId)
  }

  const { data, error } = await query
  if (error) throw error
  return data as PmTicketRow[]
}

export async function createEquipment(data: EquipmentInsert): Promise<EquipmentRow> {
  const supabase = await createClient()

  const { data: created, error } = await supabase
    .from('equipment')
    .insert(data )
    .select()
    .single()

  if (error) throw error
  return created as EquipmentRow
}

export async function updateEquipment(
  id: string,
  data: Partial<EquipmentInsert>
): Promise<EquipmentRow> {
  const supabase = await createClient()

  const { data: updated, error } = await supabase
    .from('equipment')
    .update(data )
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return updated as EquipmentRow
}

export async function deactivateEquipment(id: string): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('equipment')
    .update({ active: false } )
    .eq('id', id)

  if (error) throw error
}

// ============================================================
// Inactive Equipment Prospects
// ============================================================

export type InactiveEquipmentProspect = {
  equipmentId: string
  customerName: string | null
  customerId: number | null
  make: string | null
  model: string | null
  serialNumber: string | null
  locationOnSite: string | null
  lastServiceDate: string | null
  lastTechnician: string | null
  totalRevenue: number
  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null
  isProspect: boolean
  removed: boolean
  removalReason: string | null
  removalNote: string | null
}

export async function getInactiveEquipmentProspects(): Promise<InactiveEquipmentProspect[]> {
  const supabase = await createClient()

  // 1. Fetch inactive equipment with customer name
  const { data: equipment, error: eqError } = await supabase
    .from('equipment')
    .select('*, customers(name)')
    .eq('active', false)
    .order('updated_at', { ascending: false })

  if (eqError) throw eqError
  if (!equipment || equipment.length === 0) return []

  const equipmentIds = equipment.map((e) => e.id)

  // 2. Fetch prospect records for these equipment IDs
  const { data: prospectData } = await supabase
    .from('equipment_prospects')
    .select('*')
    .in('equipment_id', equipmentIds)

  const prospectMap = new Map<string, EquipmentProspectRow>()
  for (const p of prospectData ?? []) {
    prospectMap.set(p.equipment_id, p as EquipmentProspectRow)
  }

  // 3. Fetch ticket aggregates (last service, revenue) from completed/billed tickets
  const { data: ticketData } = await supabase
    .from('pm_tickets')
    .select('equipment_id, completed_date, billing_amount, assigned_technician_id')
    .in('equipment_id', equipmentIds)
    .in('status', ['completed', 'billed'])
    .order('completed_date', { ascending: false })

  const lastService = new Map<string, string>()
  const totalRevenue = new Map<string, number>()
  const lastTechId = new Map<string, string>()

  for (const t of ticketData ?? []) {
    if (t.equipment_id) {
      if (!lastService.has(t.equipment_id) && t.completed_date) {
        lastService.set(t.equipment_id, t.completed_date)
        if (t.assigned_technician_id) {
          lastTechId.set(t.equipment_id, t.assigned_technician_id)
        }
      }
      totalRevenue.set(
        t.equipment_id,
        (totalRevenue.get(t.equipment_id) ?? 0) + (t.billing_amount ?? 0)
      )
    }
  }

  // 4. Resolve tech names
  const techIds = Array.from(new Set(lastTechId.values()))
  const techNames = new Map<string, string>()
  if (techIds.length > 0) {
    const { data: techs } = await supabase
      .from('users')
      .select('id, name')
      .in('id', techIds)
    for (const t of techs ?? []) {
      techNames.set(t.id, t.name)
    }
  }

  // 5. Stitch together
  return equipment.map((e) => {
    const prospect = prospectMap.get(e.id)
    const customer = e.customers as { name: string } | null
    return {
      equipmentId: e.id,
      customerName: customer?.name ?? null,
      customerId: e.customer_id,
      make: e.make,
      model: e.model,
      serialNumber: e.serial_number,
      locationOnSite: e.location_on_site,
      lastServiceDate: lastService.get(e.id) ?? null,
      lastTechnician: lastTechId.has(e.id)
        ? techNames.get(lastTechId.get(e.id)!) ?? null
        : null,
      totalRevenue: totalRevenue.get(e.id) ?? 0,
      contactName: e.contact_name,
      contactEmail: e.contact_email,
      contactPhone: e.contact_phone,
      isProspect: prospect?.is_prospect ?? false,
      removed: prospect?.removed ?? false,
      removalReason: prospect?.removal_reason ?? null,
      removalNote: prospect?.removal_note ?? null,
    }
  })
}
