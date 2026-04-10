import { requireRole, MANAGER_ROLES } from '@/lib/auth'
import { getTeamAnalytics } from '@/lib/db/analytics'
import AnalyticsOverview from './AnalyticsOverview'

export default async function AnalyticsPage() {
  await requireRole(...MANAGER_ROLES)

  const today = new Date().toISOString().split('T')[0]
  const data = await getTeamAnalytics('monthly', today)

  return <AnalyticsOverview initialData={data} />
}
