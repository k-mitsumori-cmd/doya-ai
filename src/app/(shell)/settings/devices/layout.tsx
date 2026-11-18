import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'
import { isAppAuthEnabled } from '@/lib/auth-link/app-auth-flag'

/** 旗 APP_AUTH_ENABLED がオフのあいだは、この画面は無い（404）。入口のリンクも出さない */
export default function DevicesLayout({ children }: { children: ReactNode }) {
  if (!isAppAuthEnabled()) notFound()
  return <>{children}</>
}
