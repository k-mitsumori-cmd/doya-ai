import { ServiceFlowDiagram, type Step } from '@/components/lp'

export default function KintaiDiagram({ steps }: { steps: Step[] }) {
  return <ServiceFlowDiagram serviceName="ドヤ勤怠" steps={steps} accent="#00e0ff" mood="point" />
}
