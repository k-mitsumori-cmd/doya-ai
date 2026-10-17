import type { Metadata } from 'next'
import { buildServiceMetadata } from '@/lib/seo'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { LpJsonLd } from '@/components/lp'
import { getServiceById } from '@/lib/services'
import PopupAppLayout from '@/components/popup/PopupAppLayout'
import { FAQ } from './lp-data'
// ds トークン（統合仕様 R-3）。.popup-ds の中だけに効く
import '@/components/popup/popup-ds.css'

// 2026-10-18 に公開（noindex を外した）。ログイン後の画面（/popup/sites・/popup/edit）は next.config.js で noindex
export const metadata: Metadata = buildServiceMetadata('popup', {
  tagline: 'URLを入れるだけで、AIが提案するポップアップ。タグ1行で設置してクリック率まで計測',
  keywords: ['ポップアップ ツール', 'サイト ポップアップ 設置', 'HubSpot ポップアップ 代わり', 'ポップアップ クリック率', 'AIに聞く ボタン'],
})

const SVC = getServiceById('popup')!

export default async function PopupLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  // ⚠️ 未ログインをアプリ枠で包まない（空のサイドバーが出る）
  // ⚠️ 段0が入ったら、ここで ui.shell.popup を見て AppShell＋ToolFrame に載せ替える（統合仕様 §9）
  return (
    <>
      <LpJsonLd name={SVC.name} path={SVC.href} description={SVC.longDescription || SVC.description} category="BusinessApplication" features={SVC.features} faq={FAQ} />
      <div className="popup-ds">{session?.user ? <PopupAppLayout>{children}</PopupAppLayout> : children}</div>
    </>
  )
}
