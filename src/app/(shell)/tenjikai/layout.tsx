import type { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { buildServiceMetadata } from '@/lib/seo'
import { authOptions } from '@/lib/auth'
import { isShellEnabled } from '@/lib/ui-shell'
import TenjikaiApp from '@/components/tenjikai/TenjikaiApp'
import TenjikaiShellFrame from '@/components/tenjikai/TenjikaiShellFrame'
import '@/components/tenjikai/ds-tokens.css'
import './tenjikai.css'

// ⚠️ 開発中（UNLISTED_SERVICE_IDS / coming_soon）のあいだは noindex。公開するときは両方外す
export const metadata: Metadata = buildServiceMetadata('tenjikai', {
  tagline: 'URLを入れるだけで、展示会のブース設営案・制作物・ノベルティ・予算・業者選定・締切管理までを一括で準備',
  keywords: ['展示会 準備', '展示会 ブース 設営', '展示会 ノベルティ', '展示会 予算', '展示会 チェックリスト'],
  noindex: true,
})

// フラグ（UI_SHELL_SERVICES）をリクエストごとに読むため、ビルド時に固定しない
export const dynamic = 'force-dynamic'

// 画面の本体（TenjikaiApp）はここに置く。/tenjikai/<section> の page.tsx は URL を受けるだけで何も描かない。
// こうすると、セクションを移っても入力内容や生成結果が消えない。
// ⚠️ ツール独自のフォントは使わない（統合仕様 §11）。サイト共通の Inter ＋ Noto Sans JP のまま
export default async function TenjikaiLayout({ children }: { children: React.ReactNode }) {
  // 共通の枠（フラグ ui.shell.tenjikai）はログインしているときだけ。未ログインの画面は今までどおり（点検 SHL-015）。
  // 枠（AppShell）そのものは src/app/(shell)/layout.tsx が出す。ここではツール内のナビ（ToolFrame）だけ
  const session = isShellEnabled('tenjikai') ? await getServerSession(authOptions).catch(() => null) : null
  if (session?.user) {
    return (
      <>
        <TenjikaiShellFrame />
        {children}
      </>
    )
  }
  return (
    <>
      <TenjikaiApp />
      {children}
    </>
  )
}
