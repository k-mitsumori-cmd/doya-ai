import type { Metadata } from 'next'
import { buildServiceMetadata } from '@/lib/seo'
import { getServiceById } from '@/lib/services'
import { LpJsonLd } from '@/components/lp'
import { ServiceTopBar } from '@/components/ServiceTopBar'
import { FAQ } from './lp-data'

// ⚠️ これが無いと canonical がルートlayoutの既定（サイトトップ）のままになり、
//    検索エンジンからは「トップページの重複」に見えて一切拾われない。
//    サービスを追加したら必ず buildServiceMetadata を入れること。
export const metadata: Metadata = buildServiceMetadata('mensetsu', {
  tagline: 'AIアバターが一次面接を実施し、評価レポートまで作る',
  keywords: ['AI 面接', '一次面接 自動化', '採用 効率化', '構造化面接', 'AI 面接官', '採用 AI', '面接 評価'],
})

const SVC = getServiceById('mensetsu')!

export default function MensetsuLayout({ children }: { children: React.ReactNode }) {
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
      <ServiceTopBar serviceId="mensetsu" serviceName="ドヤ面接官" />
      {children}
    </>
  )
}
