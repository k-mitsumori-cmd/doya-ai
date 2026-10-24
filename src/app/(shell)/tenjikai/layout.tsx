import type { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { buildServiceMetadata } from '@/lib/seo'
import { authOptions } from '@/lib/auth'
import TenjikaiApp from '@/components/tenjikai/TenjikaiApp'
import TenjikaiShellFrame from '@/components/tenjikai/TenjikaiShellFrame'
import TenjikaiLp from './Lp'
import '@/components/tenjikai/ds-tokens.css'
import './tenjikai.css'

// ⚠️ 開発中（UNLISTED_SERVICE_IDS / coming_soon）のあいだは noindex。公開するときは両方外す
export const metadata: Metadata = buildServiceMetadata('tenjikai', {
  tagline: 'URLを入れるだけで、展示会のブース設営案・制作物・ノベルティ・予算・業者選定・締切管理までを一括で準備',
  keywords: ['展示会 準備', '展示会 ブース 設営', '展示会 ノベルティ', '展示会 予算', '展示会 チェックリスト'],
  noindex: true,
})

// ログインの有無をリクエストごとに見るため、ビルド時に固定しない
export const dynamic = 'force-dynamic'

// 画面の本体（TenjikaiApp）はここに置く。/tenjikai/<section> の page.tsx は URL を受けるだけで何も描かない。
// こうすると、セクションを移っても入力内容や生成結果が消えない。
// ⚠️ ツール独自のフォントは使わない（統合仕様 §11）。サイト共通の Inter ＋ Noto Sans JP のまま
export default async function TenjikaiLayout({ children }: { children: React.ReactNode }) {
  // 名前が取れなくても（認証の設定が無い開発環境など）、未ログインとして扱う
  const session = await getServerSession(authOptions).catch(() => null)
  // 未ログインには紹介ページ（LP）だけを出す。アプリの画面はログイン後だけ（点検 SHL-015。asklink と同じ）
  // 開発中の画面確認用（next dev でだけ効く）。ログインせずにアプリの画面を開く
  const devPreview = process.env.NODE_ENV === 'development' && process.env.TENJIKAI_DEV_PREVIEW === 'true'
  const userId = (session?.user as { id?: string } | undefined)?.id ?? null
  if (!session?.user && !devPreview) return <TenjikaiLp />
  // 共通の枠。UI_SHELL_SERVICES に関係なく、ログインしていればいつも枠に入る（2026-10-24 ユーザーの決定 FRM-05。registry.ts の always と組）。
  // 枠（AppShell）そのものは src/app/(shell)/layout.tsx が出す。ここではツール内のナビ（ToolFrame）だけ
  if (session?.user) {
    return (
      <>
        <TenjikaiShellFrame userId={userId} />
        {children}
      </>
    )
  }
  // 開発中の画面確認（ログインしていない next dev）だけ、今までの画面（独自のサイドバー）で出す
  return (
    <>
      <TenjikaiApp userId={userId} />
      {children}
    </>
  )
}
