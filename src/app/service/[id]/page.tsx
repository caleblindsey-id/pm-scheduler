import { getServiceTicket } from '@/lib/db/service-tickets'
import { getCurrentUser, isTechnician } from '@/lib/auth'
import { getSetting } from '@/lib/db/settings'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import ServiceStatusBadge from '@/components/ServiceStatusBadge'
import { ServiceTicketDetail } from './ServiceTicketDetail'

export default async function ServiceTicketPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [ticket, user, laborRateStr] = await Promise.all([
    getServiceTicket(id),
    getCurrentUser(),
    getSetting('labor_rate_per_hour'),
  ])

  if (!user) redirect('/login')
  if (!ticket) notFound()

  // Techs can only see their own assigned tickets
  if (isTechnician(user.role) && ticket.assigned_technician_id !== user.id) {
    redirect('/')
  }

  const laborRate = laborRateStr ? parseFloat(laborRateStr) : 75

  const equipmentLabel = ticket.equipment
    ? [ticket.equipment.make, ticket.equipment.model].filter(Boolean).join(' ')
    : [ticket.equipment_make, ticket.equipment_model].filter(Boolean).join(' ') || null

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/service"
            className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-400 transition-colors p-3 -m-3 rounded-md"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white">
              Service Ticket
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 truncate">
              {ticket.work_order_number ? `WO-${ticket.work_order_number}` : 'No WO#'}
              {' — '}
              {ticket.customers?.name ?? 'Unknown Customer'}
              {equipmentLabel ? ` — ${equipmentLabel}` : ''}
            </p>
          </div>
        </div>
        <div className="pl-8 sm:pl-0 sm:ml-auto">
          <ServiceStatusBadge status={ticket.status} />
        </div>
      </div>

      <ServiceTicketDetail
        ticket={ticket}
        userRole={user.role}
        userId={user.id}
        laborRate={laborRate}
      />
    </div>
  )
}
