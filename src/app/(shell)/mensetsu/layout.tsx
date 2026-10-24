import type { Metadata } from 'next'
import { buildServiceMetadata } from '@/lib/seo'
import { getServiceById } from '@/lib/services'
import { LpJsonLd } from '@/components/lp'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import MensetsuShellFrame from '@/components/mensetsu/MensetsuShellFrame'
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
      {/* ⚠️ ログイン後は共通の枠の中に出す（ToolFrame だけ。枠は (shell)/layout.tsx が描く）。独自ヘッダーを作らないこと。 */}
      {/* 面接・招待の画面は台帳と guest-path で枠の外 */}
      {!session?.user ? children : <MensetsuShellFrame>{children}</MensetsuShellFrame>}
    </>
  )
}
