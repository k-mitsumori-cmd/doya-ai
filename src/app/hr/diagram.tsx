import { ServiceFlowDiagram, type Step } from '@/components/lp'

export default function HrDiagram({ steps }: { steps: Step[] }) {
  return <ServiceFlowDiagram serviceName="ドヤHR" steps={steps} accent="#009bff" mood="point" />
}
