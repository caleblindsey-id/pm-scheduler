import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { ServiceTicketBoard } from './ServiceTicketBoard'

export default async function ServicePage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  // Both office staff AND techs can access (techs see their own tickets only)
  return <ServiceTicketBoard currentUser={user} />
}
