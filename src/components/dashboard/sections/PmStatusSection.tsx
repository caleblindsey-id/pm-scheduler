import Link from 'next/link'
import {
  ClipboardList,
  UserCheck,
  Play,
  CheckCircle,
  Receipt,
  SkipForward,
  AlertTriangle,
} from 'lucide-react'
import ZoneHeader from '@/components/dashboard/ZoneHeader'
import { getDashboardPmSummary } from '@/lib/db/tickets'
import type { TicketStatus } from '@/types/database'

const statusCards: {
  status: TicketStatus
  label: string
  icon: typeof ClipboardList
  color: string
}[] = [
  { status: 'unassigned', label: 'Unassigned', icon: ClipboardList, color: 'text-yellow-500' },
  { status: 'assigned', label: 'Assigned', icon: UserCheck, color: 'text-blue-500' },
  { status: 'in_progress', label: 'In Progress', icon: Play, color: 'text-orange-500' },
  { status: 'completed', label: 'Completed', icon: CheckCircle, color: 'text-green-500' },
  { status: 'billed', label: 'Billed', icon: Receipt, color: 'text-purple-500' },
  { status: 'skipped', label: 'Skipped', icon: SkipForward, color: 'text-gray-400' },
  { status: 'skip_requested', label: 'Skip Requested', icon: AlertTriangle, color: 'text-amber-500' },
]

type Props = {
  month: number
  year: number
  monthName: string
}

export default async function PmStatusSection({ month, year, monthName }: Props) {
  const tickets = await getDashboardPmSummary(month, year)

  const counts: Record<TicketStatus, number> = {
    unassigned: 0,
    assigned: 0,
    in_progress: 0,
    completed: 0,
    billed: 0,
    skipped: 0,
    skip_requested: 0,
  }
  for (const t of tickets) counts[t.status]++

  return (
    <section>
      <ZoneHeader label={`PM Tickets — ${monthName}`} />
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
        {statusCards.map((card) => {
          const Icon = card.icon
          return (
            <Link
              key={card.status}
              href={`/tickets?month=${month}&year=${year}&status=${card.status}`}
              className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow transition-all"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {card.label}
                </span>
                <Icon className={`h-5 w-5 ${card.color}`} />
              </div>
              <p className="mt-2 text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white tabular-nums">
                {counts[card.status]}
              </p>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
