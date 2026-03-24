import { getTickets } from '@/lib/db/tickets'
import { getUsers } from '@/lib/db/users'
import { TicketStatus } from '@/types/database'
import TicketBoard from './TicketBoard'

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string; tech?: string; status?: string }>
}) {
  const params = await searchParams
  const now = new Date()
  const month = params.month ? parseInt(params.month) : now.getMonth() + 1
  const year = params.year ? parseInt(params.year) : now.getFullYear()

  const filters: Parameters<typeof getTickets>[0] = { month, year }
  if (params.tech) filters!.technicianId = params.tech
  if (params.status) filters!.status = params.status as TicketStatus

  let tickets: Awaited<ReturnType<typeof getTickets>> = []
  let users: Awaited<ReturnType<typeof getUsers>> = []
  let fetchError = false
  try {
    ;[tickets, users] = await Promise.all([getTickets(filters), getUsers(true)])
  } catch {
    fetchError = true
  }

  return (
    <div className="p-6 space-y-6">
      {fetchError && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-md px-4 py-3 text-sm">
          Unable to load tickets. Check your connection and refresh the page.
        </div>
      )}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Tickets</h1>
        <p className="text-sm text-gray-500 mt-1">
          Monthly PM ticket board
        </p>
      </div>
      <TicketBoard
        tickets={tickets}
        users={users}
        currentMonth={month}
        currentYear={year}
      />
    </div>
  )
}
