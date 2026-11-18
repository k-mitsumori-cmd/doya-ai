import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'
import { isAppAuthEnabled } from '@/lib/auth-link/app-auth-flag'

// 待ちの ID が URL に入るので、ほかのサイトへ Referer を送らない。検索にも出さない
export const metadata: Metadata = { title: 'ログイン手段の追加', referrer: 'no-referrer', robots: { index: false, follow: false } }

/** 旗 APP_AUTH_ENABLED がオフのあいだは、この画面は無い（404）。ログイン画面に入口も出さない */
export default function LinkLayout({ children }: { children: ReactNode }) {
  if (!isAppAuthEnabled()) notFound()
  return <>{children}</>
}
