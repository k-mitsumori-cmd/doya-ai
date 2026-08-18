import type { Metadata } from 'next'
import { buildServiceMetadata } from '@/lib/seo'
import { getServiceById } from '@/lib/services'
import { LpJsonLd } from '@/components/lp'
import { ServiceTopBar } from '@/components/ServiceTopBar'
import { FAQ } from './lp-data'

// ⚠️ これが無いと canonical がルートlayoutの既定（サイトトップ）のままになり、
//    検索エンジンからは「トップページの重複」に見えて一切拾われない。
//    サービスを追加したら必ず buildServiceMetadata を入れること。
export const metadata: Metadata = buildServiceMetadata('quote', {
  tagline: 'URLを入れるだけで相場つきの見積もり品目。商談中に編集してその場でPDF',
  keywords: ['見積書 作成', 'AI 見積もり', '見積書 テンプレート', '相場 見積もり', '見積書 PDF', '商談 見積もり', 'インボイス 見積書'],
})

const SVC = getServiceById('quote')!

export default function QuoteLayout({ children }: { children: React.ReactNode }) {
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
      <ServiceTopBar serviceId="quote" serviceName="ドヤ見積もりAI" />
      {children}
    </>
  )
}
