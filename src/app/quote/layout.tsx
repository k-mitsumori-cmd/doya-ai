import type { Metadata } from 'next'
import { buildServiceMetadata } from '@/lib/seo'
import { getServiceById } from '@/lib/services'
import { LpJsonLd } from '@/components/lp'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import QuoteAppLayout from '@/components/quote/QuoteAppLayout'
import { FAQ } from './lp-data'

// ⚠️ これが無いと canonical がルートlayoutの既定（サイトトップ）のままになり、
//    検索エンジンからは「トップページの重複」に見えて一切拾われない。
//    サービスを追加したら必ず buildServiceMetadata を入れること。
export const metadata: Metadata = buildServiceMetadata('quote', {
  // 開発中のため検索結果に出さない（2026-08-23）。
  // 公開する時はこの1行と services.ts の UNLISTED_SERVICE_IDS を一緒に外す。
  noindex: true,
  tagline: 'URLを入れるだけで相場つきの見積もり品目。商談中に編集してその場でPDF',
  keywords: ['見積書 作成', 'AI 見積もり', '見積書 テンプレート', '相場 見積もり', '見積書 PDF', '商談 見積もり', 'インボイス 見積書'],
})

const SVC = getServiceById('quote')!

// ⚠️ 未ログインではアプリ枠（サイドバー）を被せないこと。
//    未ログインに見せるのはLPで、サイドバーは要らない。被せると
//    LPの左に空のサイドバーが出るうえ、doyalist では読み込み表示で
//    本文がHTMLに入らなくなる事故も起きた。
export default async function QuoteLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
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
      {/* ⚠️ ログイン後はサイドバー付きのアプリ枠で包む（reference/06-ui-patterns.md §7）。
           ToolSwitcherMenu はサイドバーの中にある。独自ヘッダーを作らないこと。 */}
      {session?.user ? <QuoteAppLayout>{children}</QuoteAppLayout> : children}
    </>
  )
}
