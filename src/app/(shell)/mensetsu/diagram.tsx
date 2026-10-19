import { ServiceFlowDiagram, type Step } from '@/components/lp'

export default function MensetsuDiagram({ steps }: { steps: Step[] }) {
  return <ServiceFlowDiagram serviceName="ドヤ面接官" steps={steps} accent="#ff1e72" mood="point" />
}
