import ScheduleSummary from '@/components/dashboard/ScheduleSummary'
import { getDashboardPmSummary } from '@/lib/db/tickets'

type Props = {
  month: number
  year: number
  monthName: string
}

export default async function ScheduleSection({ month, year, monthName }: Props) {
  const tickets = await getDashboardPmSummary(month, year)

  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay())
  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(startOfWeek.getDate() + 7)

  let today = 0
  let thisWeek = 0
  let unscheduled = 0
  for (const t of tickets) {
    if (t.status === 'completed' || t.status === 'billed' || t.status === 'skipped') continue
    if (!t.scheduled_date) {
      unscheduled++
      continue
    }
    if (t.scheduled_date === todayStr) today++
    const d = new Date(t.scheduled_date)
    if (d >= startOfWeek && d < endOfWeek) thisWeek++
  }

  return (
    <ScheduleSummary
      today={today}
      thisWeek={thisWeek}
      unscheduled={unscheduled}
      monthName={monthName}
      month={month}
      year={year}
    />
  )
}
