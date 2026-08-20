import { ServiceFlowDiagram, type Step } from '@/components/lp'

export default function SfaDiagram({ steps }: { steps: Step[] }) {
  return <ServiceFlowDiagram serviceName="ドヤ営業管理" steps={steps} accent="#009bff" mood="point" />
}
