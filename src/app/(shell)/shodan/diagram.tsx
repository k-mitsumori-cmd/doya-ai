import { ServiceFlowDiagram, type Step } from '@/components/lp'

export default function ShodanDiagram({ steps }: { steps: Step[] }) {
  return <ServiceFlowDiagram serviceName="ドヤ商談準備" steps={steps} accent="#ffd400" mood="point" />
}
