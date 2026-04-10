import { requireRole, MANAGER_ROLES } from '@/lib/auth'
import { getTechnicianAnalytics } from '@/lib/db/analytics'
import TechnicianProfile from './TechnicianProfile'

export default async function TechnicianAnalyticsPage({
  params,
}: {
  params: Promise<{ technicianId: string }>
}) {
  await requireRole(...MANAGER_ROLES)

  const { technicianId } = await params
  const today = new Date().toISOString().split('T')[0]
  const data = await getTechnicianAnalytics(technicianId, 'monthly', today)

  return <TechnicianProfile initialData={data} />
}
