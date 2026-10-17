import type { Metadata } from 'next'
import { buildServiceMetadata } from '@/lib/seo'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { isShellEnabled } from '@/lib/ui-shell'
import { tokens } from '@/components/ds'
import PopupAppLayout from '@/components/popup/PopupAppLayout'
import PopupShellFrame from '@/components/popup/PopupShellFrame'
// .pd-*（ポップアップの画面だけで使う見た目）。トークンは段0の .ds（tokens.module.css）を読む
import '@/components/popup/popup-ds.css'

// ⚠️ 開発中（UNLISTED_SERVICE_IDS）の間は noindex。公開するときに外す（reference/services/popup.md 13章）
export const metadata: Metadata = buildServiceMetadata('popup', {
  tagline: 'URLを入れるだけで、AIが提案するポップアップ。タグ1行で設置してクリック率まで計測',
  keywords: ['ポップアップ ツール', 'サイト ポップアップ 設置', 'HubSpot ポップアップ 代わり', 'ポップアップ クリック率', 'AIに聞く ボタン'],
  noindex: true,
})

export default async function PopupLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  // ⚠️ 未ログインをアプリ枠で包まない（LP に空のサイドバーが出る）
  if (!session?.user) {
    return <div className={`${tokens.ds} popup-ds`}>{children}</div>
  }
  // 統合仕様 §9: ui.shell.popup が ON のときだけ共通シェルに載せる。OFF の間は従来の枠
  // ⚠️ 公開の口（/api/popup/public/*・/popup/embed.js）はこの layout を通らない（R-7）
  if (isShellEnabled('popup')) {
    return (
      <div className="popup-ds">
        <PopupShellFrame userName={session.user.name}>{children}</PopupShellFrame>
      </div>
    )
  }
  return (
    <div className={`${tokens.ds} popup-ds`}>
      <PopupAppLayout>{children}</PopupAppLayout>
    </div>
  )
}
