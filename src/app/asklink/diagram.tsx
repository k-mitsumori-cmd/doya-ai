import { ServiceFlowDiagram, type Step } from '@/components/lp'

export default function AsklinkDiagram({ steps }: { steps: Step[] }) {
  return <ServiceFlowDiagram serviceName="ドヤAI質問リンク" steps={steps} accent="#0066ff" mood="point" />
}
