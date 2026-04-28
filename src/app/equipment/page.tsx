import { getEquipment } from '@/lib/db/equipment'
import { requireRole, MANAGER_ROLES } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import EquipmentList from './EquipmentList'

export type EquipmentListItem = Awaited<ReturnType<typeof getEquipment>>[number] & {
  lastServiceDate: string | null
  nextServiceDate: string | null
}

function calcNextServiceDate(
  intervalMonths: number,
  anchorMonth: number,
  now: Date,
  existingTicketKeys: Set<string>
): string | null {
  // Sanity guards — corrupted schedule data could otherwise produce NaN dates
  // or wrong cadences. Migration 048 also adds CHECK constraints so this is
  // belt-and-suspenders going forward.
  if (!Number.isFinite(intervalMonths) || intervalMonths <= 0) return null
  if (!Number.isFinite(anchorMonth) || anchorMonth < 1 || anchorMonth > 12) return null

  const currentMonth = now.getMonth() + 1 // 1-12
  const currentYear = now.getFullYear()

  // Check up to 24 months out to find the next service month without an existing ticket
  for (let offset = 0; offset < 24; offset++) {
    const candidateMonth = ((currentMonth - 1 + offset) % 12) + 1
    const candidateYear = currentYear + Math.floor((currentMonth - 1 + offset) / 12)

    const diff = ((candidateMonth - anchorMonth) % intervalMonths + intervalMonths) % intervalMonths
    if (diff === 0) {
      const key = `${candidateYear}-${candidateMonth}`
      if (!existingTicketKeys.has(key)) {
        return `${candidateYear}-${String(candidateMonth).padStart(2, '0')}`
      }
    }
  }

  return null
}

export default async function EquipmentPage() {
  await requireRole(...MANAGER_ROLES)
  const equipment = await getEquipment()

  const equipmentIds = equipment.map((e) => e.id)
  const lastServiceMap = new Map<string, string>()
  // Map of equipmentId -> Set of "year-month" keys for existing tickets
  const ticketsByEquipment = new Map<string, Set<string>>()

  if (equipmentIds.length > 0) {
    const supabase = await createClient()

    // Batch-fetch all pm_tickets for these equipment IDs
    const { data: tickets } = await supabase
      .from('pm_tickets')
      .select('equipment_id, completed_date, status, month, year')
      .in('equipment_id', equipmentIds)
      .is('deleted_at', null)
      .order('completed_date', { ascending: false })

    for (const t of tickets ?? []) {
      if (!t.equipment_id) continue

      // Build last service date from completed/billed tickets
      if ((t.status === 'completed' || t.status === 'billed') && t.completed_date && !lastServiceMap.has(t.equipment_id)) {
        lastServiceMap.set(t.equipment_id, t.completed_date)
      }

      // Track which month/year combos already have a ticket (any status except skipped)
      if (t.status !== 'skipped' && t.month && t.year) {
        if (!ticketsByEquipment.has(t.equipment_id)) {
          ticketsByEquipment.set(t.equipment_id, new Set())
        }
        ticketsByEquipment.get(t.equipment_id)!.add(`${t.year}-${t.month}`)
      }
    }
  }

  // Calculate next service dates from schedules
  const now = new Date()
  const enriched: EquipmentListItem[] = equipment.map((e) => {
    const activeSchedule = e.pm_schedules?.find((s) => s.active)
    let nextServiceDate: string | null = null
    if (activeSchedule) {
      const existingKeys = ticketsByEquipment.get(e.id) ?? new Set()
      nextServiceDate = calcNextServiceDate(
        activeSchedule.interval_months,
        activeSchedule.anchor_month,
        now,
        existingKeys
      )
    }

    return {
      ...e,
      lastServiceDate: lastServiceMap.get(e.id) ?? null,
      nextServiceDate,
    }
  })

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Equipment</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Manage customer equipment and PM schedules
        </p>
      </div>
      <EquipmentList equipment={enriched} />
    </div>
  )
}
