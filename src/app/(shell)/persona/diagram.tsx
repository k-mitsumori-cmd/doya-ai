import { ServiceFlowDiagram, type Step } from '@/components/lp'

export default function PersonaDiagram({ steps }: { steps: Step[] }) {
  return <ServiceFlowDiagram serviceName="ドヤペルソナAI" steps={steps} accent="#009bff" mood="point" />
}
