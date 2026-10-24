import type { Metadata } from 'next'
import { buildServiceMetadata } from '@/lib/seo'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
// ⚠️ トークンは CSS モジュールを直接読む。'@/components/ds'（'use client' の index.tsx）経由だと、
//    サーバの layout では tokens.ds が undefined になり配色が崩れる（SHL-098）
import tokens from '@/components/ds/tokens.module.css'
import PopupShellFrame from '@/components/popup/PopupShellFrame'
import { POPUP_NAV } from '@/lib/popup/nav'
import { LpJsonLd } from '@/components/lp'
import { getServiceById } from '@/lib/services'
import { FAQ } from './lp-data'

const SVC = getServiceById('popup')!
// .pd-*（ポップアップの画面だけで使う見た目）。トークンは段0の .ds（tokens.module.css）を読む
import '@/components/popup/popup-ds.css'

// 2026-10-18 に公開（noindex を外した）。ログイン後の画面（/popup/sites・/popup/edit）は next.config.js で noindex
export const metadata: Metadata = buildServiceMetadata('popup', {
  tagline: 'URLを入れるだけで、AIが提案するポップアップ。タグ1行で設置してクリック率まで計測',
  keywords: ['ポップアップ ツール', 'サイト ポップアップ 設置', 'HubSpot ポップアップ 代わり', 'ポップアップ クリック率', 'AIに聞く ボタン'],
})

export default async function PopupLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  const jsonLd = <LpJsonLd name={SVC.name} path={SVC.href} description={SVC.longDescription || SVC.description} category="BusinessApplication" features={SVC.features} faq={FAQ} />
  // ⚠️ 未ログインをアプリ枠で包まない（LP に空のサイドバーが出る）
  if (!session?.user) {
    return (
      <>
        {jsonLd}
        <div className={`${tokens.ds} popup-ds`}>{children}</div>
      </>
    )
  }
  // ログイン後は共通シェルに載せる（統合仕様 §9）
  // ⚠️ 公開の口（/api/popup/public/*・/popup/embed.js）はこの layout を通らない（R-7）
  return (
    <>
      {jsonLd}
      <div className="popup-ds">
        <PopupShellFrame nav={POPUP_NAV}>{children}</PopupShellFrame>
      </div>
    </>
  )
}
