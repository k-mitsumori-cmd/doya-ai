import { ServiceFlowDiagram, type Step } from '@/components/lp'

export default function AioDiagram({ steps }: { steps: Step[] }) {
  return <ServiceFlowDiagram serviceName="ドヤAIO" steps={steps} accent="#00e0ff" mood="point" />
}
