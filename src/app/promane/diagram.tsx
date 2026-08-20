import { ServiceFlowDiagram, type Step } from '@/components/lp'

export default function PromaneDiagram({ steps }: { steps: Step[] }) {
  return <ServiceFlowDiagram serviceName="ドヤプロマネ" steps={steps} accent="#009bff" mood="point" />
}
