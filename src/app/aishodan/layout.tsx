import type { Metadata } from 'next'
import { buildServiceMetadata } from '@/lib/seo'
import { getServiceById } from '@/lib/services'
import { LpJsonLd } from '@/components/lp'
import { ServiceTopBar } from '@/components/ServiceTopBar'
import { FAQ } from './lp-data'

// ⚠️ これが無いと canonical がルートlayoutの既定（サイトトップ）のままになり、
//    検索エンジンからは「トップページの重複」に見えて一切拾われない。
//    サービスを追加したら必ず buildServiceMetadata を入れること。
export const metadata: Metadata = buildServiceMetadata('aishodan', {
  tagline: 'AIが音声で一次商談を進行し、適合度の判定まで残す',
  keywords: ['AI 商談', '一次対応 自動化', 'インサイドセールス AI', '商談 自動化', 'AI 営業', 'リード対応 AI', '商談 ログ'],
})

const SVC = getServiceById('aishodan')!

export default function AishodanLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <LpJsonLd
        name={SVC.name}
        path={SVC.href}
        description={SVC.longDescription || SVC.description}
        category="BusinessApplication"
        features={SVC.features}
        faq={FAQ}
      />
      {/* ⚠️ サービスを追加したら必ず共通ヘッダーを入れること。無いとそのサービスに
           入った利用者が他のツールへ移れず、トップへ戻る導線も無くなる。
           ゲスト画面（応募者・見込み客が開く経路）では ServiceTopBar 側で自動的に隠れる。 */}
      <ServiceTopBar serviceId="aishodan" serviceName="ドヤAI商談" />
      {children}
    </>
  )
}
