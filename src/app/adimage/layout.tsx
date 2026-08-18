import type { Metadata } from 'next'
import { buildServiceMetadata } from '@/lib/seo'
import { getServiceById } from '@/lib/services'
import { LpJsonLd } from '@/components/lp'
import { ServiceTopBar } from '@/components/ServiceTopBar'
import { FAQ } from './lp-data'

// ⚠️ これが無いと canonical がルートlayoutの既定（サイトトップ）のままになり、
//    検索エンジンからは「トップページの重複」に見えて一切拾われない。
//    サービスを追加したら必ず buildServiceMetadata を入れること。
export const metadata: Metadata = buildServiceMetadata('adimage', {
  tagline: 'URLから媒体別サイズの広告画像を文字込みで一括生成',
  keywords: ['広告画像 作成', 'バナー 自動生成', '広告クリエイティブ AI', 'Meta広告 画像', 'Google広告 バナー', '広告 入稿 サイズ', 'AI バナー'],
})

const SVC = getServiceById('adimage')!

export default function AdimageLayout({ children }: { children: React.ReactNode }) {
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
      <ServiceTopBar serviceId="adimage" serviceName="ドヤ広告画像AI" />
      {children}
    </>
  )
}
