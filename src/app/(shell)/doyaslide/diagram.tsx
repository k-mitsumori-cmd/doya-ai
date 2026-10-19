import { ServiceFlowDiagram, type Step } from '@/components/lp'

export default function DoyaslideDiagram({ steps }: { steps: Step[] }) {
  return <ServiceFlowDiagram serviceName="ドヤスライド" steps={steps} accent="#00e0ff" mood="point" />
}
