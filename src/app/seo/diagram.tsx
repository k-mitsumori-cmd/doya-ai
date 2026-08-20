import { ServiceFlowDiagram, type Step } from '@/components/lp'

export default function SeoDiagram({ steps }: { steps: Step[] }) {
  return <ServiceFlowDiagram serviceName="ドヤSEO" steps={steps} accent="#00e0ff" mood="point" />
}
