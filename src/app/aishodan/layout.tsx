import type { Metadata } from 'next'
import { buildServiceMetadata } from '@/lib/seo'
import { getServiceById } from '@/lib/services'
import { LpJsonLd } from '@/components/lp'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import AishodanAppLayout from '@/components/aishodan/AishodanAppLayout'
import { FAQ } from './lp-data'

// ⚠️ これが無いと canonical がルートlayoutの既定（サイトトップ）のままになり、
//    検索エンジンからは「トップページの重複」に見えて一切拾われない。
//    サービスを追加したら必ず buildServiceMetadata を入れること。
export const metadata: Metadata = buildServiceMetadata('aishodan', {
  // 開発中のため検索結果に出さない（2026-08-23）。
  // 公開する時はこの1行と services.ts の UNLISTED_SERVICE_IDS を一緒に外す。
  noindex: true,
  tagline: 'AIが音声で一次商談を進行し、適合度の判定まで残す',
  keywords: ['AI 商談', '一次対応 自動化', 'インサイドセールス AI', '商談 自動化', 'AI 営業', 'リード対応 AI', '商談 ログ'],
})

const SVC = getServiceById('aishodan')!

// ⚠️ 未ログインではアプリ枠（サイドバー）を被せないこと。
//    未ログインに見せるのはLPで、サイドバーは要らない。被せると
//    LPの左に空のサイドバーが出るうえ、doyalist では読み込み表示で
//    本文がHTMLに入らなくなる事故も起きた。
export default async function AishodanLayout({ children }: { children: React.ReactNode }) {
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
      {session?.user ? <AishodanAppLayout>{children}</AishodanAppLayout> : children}
    </>
  )
}
