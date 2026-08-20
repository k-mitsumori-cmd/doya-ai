import { ServiceFlowDiagram, type Step } from '@/components/lp'

export default function InterviewDiagram({ steps }: { steps: Step[] }) {
  return <ServiceFlowDiagram serviceName="ドヤインタビュー" steps={steps} accent="#ff1e72" mood="point" />
}
