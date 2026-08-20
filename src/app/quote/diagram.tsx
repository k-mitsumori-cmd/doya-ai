import { ServiceFlowDiagram, type Step } from '@/components/lp'

export default function QuoteDiagram({ steps }: { steps: Step[] }) {
  return <ServiceFlowDiagram serviceName="ドヤ見積もりAI" steps={steps} accent="#ffd400" mood="point" />
}
