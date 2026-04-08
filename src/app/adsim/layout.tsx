import type { Metadata } from 'next'
import AdSimAppLayout from '@/components/AdSimAppLayout'

export const metadata: Metadata = {
  title: 'ドヤ広告シミュレーションAI | 広告提案資料を AI が一発生成',
  description:
    'LP URL と月額予算を入れるだけで、業種・ターゲット・KPI・媒体配分・提案文10セクション・PDF/PPTX/Excel まで AI が全部判断する広告提案ツール',
}

export default function AdSimLayout({ children }: { children: React.ReactNode }) {
  return <AdSimAppLayout>{children}</AdSimAppLayout>
}
