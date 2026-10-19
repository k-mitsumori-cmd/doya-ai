import { ServiceFlowDiagram, type Step } from '@/components/lp'

export default function AdimageDiagram({ steps }: { steps: Step[] }) {
  return <ServiceFlowDiagram serviceName="ドヤ広告画像AI" steps={steps} accent="#ff1e72" mood="point" />
}
