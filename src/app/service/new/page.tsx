import { requireRole } from '@/lib/auth'
import { MANAGER_ROLES } from '@/types/database'
import { CreateServiceTicketForm } from './CreateServiceTicketForm'

export default async function NewServiceTicketPage() {
  await requireRole(...MANAGER_ROLES)
  return <CreateServiceTicketForm />
}
