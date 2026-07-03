import type { Metadata } from 'next'
import { generateToolSchema } from '@/lib/seo'
import AdSimAppLayout from '@/components/AdSimAppLayout'

export const metadata: Metadata = {
  alternates: {
    canonical: '/adsim',
  },
  title: 'ドヤ広告シミュレーションAI | 広告提案資料を AI が一発生成',
  description:
    'LP URL と月額予算を入れるだけで、業種・ターゲット・KPI・媒体配分・提案文10セクション・PDF/PPTX/Excel まで AI が全部判断する広告提案ツール',
}

export default function AdSimLayout({ children }: { children: React.ReactNode }) {
  const toolSchema = generateToolSchema({ path: '/adsim', name: 'ドヤ広告シミュレーションAI', description: '広告予算と商材から、媒体別シミュレーションと提案資料をAIが一括生成するツール。', category: 'BusinessApplication' })
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(toolSchema) }} />
      <AdSimAppLayout>{children}</AdSimAppLayout>
    </>
  )
}
