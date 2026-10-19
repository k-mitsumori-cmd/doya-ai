import { ServiceFlowDiagram, type Step } from '@/components/lp'

export default function BannerDiagram({ steps }: { steps: Step[] }) {
  return <ServiceFlowDiagram serviceName="ドヤバナーAI" steps={steps} accent="#00e0ff" mood="point" />
}
