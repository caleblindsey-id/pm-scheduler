import PartsPipeline from '@/components/dashboard/PartsPipeline'
import {
  getPartsToOrderCount,
  getPartsOnOrderCount,
  getPartsReadyForPickupCount,
} from '@/lib/db/service-tickets'

export default async function PartsPipelineSection() {
  const [
    pmPartsToOrder,
    pmPartsOnOrder,
    pmPartsReady,
    svcPartsToOrder,
    svcPartsOnOrder,
    svcPartsReady,
  ] = await Promise.all([
    getPartsToOrderCount('pm'),
    getPartsOnOrderCount(undefined, 'pm'),
    getPartsReadyForPickupCount(undefined, 'pm'),
    getPartsToOrderCount('service'),
    getPartsOnOrderCount(undefined, 'service'),
    getPartsReadyForPickupCount(undefined, 'service'),
  ])

  return (
    <PartsPipeline
      isTech={false}
      pmPartsToOrder={pmPartsToOrder}
      pmPartsOnOrder={pmPartsOnOrder}
      pmPartsReady={pmPartsReady}
      svcPartsToOrder={svcPartsToOrder}
      svcPartsOnOrder={svcPartsOnOrder}
      svcPartsReady={svcPartsReady}
    />
  )
}
