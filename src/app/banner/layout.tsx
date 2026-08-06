import { Metadata } from 'next'
import { buildServiceMetadata } from '@/lib/seo'
import { getServiceById } from '@/lib/services'
import { LpJsonLd } from '@/components/lp'
import PlanUpdatedListener from '@/components/PlanUpdatedListener'

// ============================================
// ドヤバナーAI メタデータ
// ============================================
// 正本は services.ts。title は「ドヤバナーAI｜…」で始まり、
// ルートlayoutのtemplateで末尾に「| ドヤマーケAI」が付く。
// 配下のページ（/banner/pricing 等）は各自 metadata を持ち、
// このLPと同じ title を継承しない（指名検索の受け皿をLPに寄せるため）。
export const metadata: Metadata = buildServiceMetadata('banner', {
  keywords: ['AIバナー生成', 'バナー自動生成', 'プロ品質バナー', '広告バナー', 'ABテスト', 'デザイン自動化', 'Facebook広告', 'Instagram広告', 'SNS広告'],
})

const SVC = getServiceById('banner')!

export default function BannerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <LpJsonLd
        name={SVC.name}
        path={SVC.href}
        description={SVC.longDescription || SVC.description}
        category="DesignApplication"
        features={SVC.features}
      />
      {/* 決済直後など、プラン更新イベントを受けてUIを即時反映 */}
      <PlanUpdatedListener />
      {children}
    </>
  )
}
