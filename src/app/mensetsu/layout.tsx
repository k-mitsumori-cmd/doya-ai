import type { Metadata } from 'next'
import { buildServiceMetadata } from '@/lib/seo'
import { getServiceById } from '@/lib/services'
import { LpJsonLd } from '@/components/lp'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import MensetsuAppLayout from '@/components/mensetsu/MensetsuAppLayout'
import { FAQ } from './lp-data'

// ⚠️ これが無いと canonical がルートlayoutの既定（サイトトップ）のままになり、
//    検索エンジンからは「トップページの重複」に見えて一切拾われない。
//    サービスを追加したら必ず buildServiceMetadata を入れること。
export const metadata: Metadata = buildServiceMetadata('mensetsu', {
  tagline: 'AIアバターが一次面接を実施し、評価レポートまで作る',
  keywords: ['AI 面接', '一次面接 自動化', '採用 効率化', '構造化面接', 'AI 面接官', '採用 AI', '面接 評価'],
})

const SVC = getServiceById('mensetsu')!

// ⚠️ 未ログインではアプリ枠（サイドバー）を被せないこと。
//    未ログインに見せるのはLPで、サイドバーは要らない。被せると
//    LPの左に空のサイドバーが出るうえ、doyalist では読み込み表示で
//    本文がHTMLに入らなくなる事故も起きた。
export default async function MensetsuLayout({ children }: { children: React.ReactNode }) {
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
      {session?.user ? <MensetsuAppLayout>{children}</MensetsuAppLayout> : children}
    </>
  )
}
