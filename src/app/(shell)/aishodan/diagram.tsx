import { ServiceFlowDiagram, type Step } from '@/components/lp'

export default function AishodanDiagram({ steps }: { steps: Step[] }) {
  return <ServiceFlowDiagram serviceName="ドヤAI商談" steps={steps} accent="#00e0ff" mood="point" />
}
