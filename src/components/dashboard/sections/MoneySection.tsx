import PipelineAndMoney from '@/components/dashboard/PipelineAndMoney'
import {
  getEstimatesPipeline,
  getTechLeadsPipeline,
  getTechLeadBonusLeaderboard,
} from '@/lib/db/dashboard-metrics'

export default async function MoneySection() {
  const [techLeadsPipeline, bonusLeaderboard, estimatesPipeline] = await Promise.all([
    getTechLeadsPipeline(),
    getTechLeadBonusLeaderboard(5),
    getEstimatesPipeline(),
  ])

  return (
    <PipelineAndMoney
      techLeads={techLeadsPipeline}
      bonusLeaderboard={bonusLeaderboard}
      estimates={estimatesPipeline}
    />
  )
}
