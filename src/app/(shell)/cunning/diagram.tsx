import { ServiceFlowDiagram, type Step } from '@/components/lp'

export default function CunningDiagram({ steps }: { steps: Step[] }) {
  return <ServiceFlowDiagram serviceName="ドヤカンニング" steps={steps} accent="#ff1e72" mood="point" />
}
