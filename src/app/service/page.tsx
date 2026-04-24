import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { ServiceTicketBoard } from './ServiceTicketBoard'

export default async function ServicePage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  // Both office staff AND techs can access (techs see their own tickets only)
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Service Tickets</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          On-demand service requests — inside shop and field calls
        </p>
      </div>
      <ServiceTicketBoard currentUser={user} />
    </div>
  )
}
