import type { Metadata } from 'next'
import { buildServiceMetadata } from '@/lib/seo'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import PopupAppLayout from '@/components/popup/PopupAppLayout'
// ds トークン（統合仕様 R-3）。.popup-ds の中だけに効く
import '@/components/popup/popup-ds.css'

// ⚠️ 開発中（UNLISTED_SERVICE_IDS）の間は noindex。公開するときに外す（reference/services/popup.md 13章）
export const metadata: Metadata = buildServiceMetadata('popup', {
  tagline: 'URLを入れるだけで、AIが提案するポップアップ。タグ1行で設置してクリック率まで計測',
  keywords: ['ポップアップ ツール', 'サイト ポップアップ 設置', 'HubSpot ポップアップ 代わり', 'ポップアップ クリック率', 'AIに聞く ボタン'],
  noindex: true,
})

export default async function PopupLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  // ⚠️ 未ログインをアプリ枠で包まない（空のサイドバーが出る）
  // ⚠️ 段0が入ったら、ここで ui.shell.popup を見て AppShell＋ToolFrame に載せ替える（統合仕様 §9）
  return <div className="popup-ds">{session?.user ? <PopupAppLayout>{children}</PopupAppLayout> : children}</div>
}
