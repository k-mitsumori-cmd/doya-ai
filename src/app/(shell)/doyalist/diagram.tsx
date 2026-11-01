import { ServiceFlowDiagram, type Step } from '@/components/lp'

export default function DoyalistDiagram({ steps }: { steps: Step[] }) {
  return <ServiceFlowDiagram serviceName="ドヤリスト" steps={steps} accent="#ffd400" mood="point" />
}
