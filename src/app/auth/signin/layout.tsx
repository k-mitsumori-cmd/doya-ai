import type { Metadata } from 'next'
import { SITE_CONFIG } from '@/lib/seo'

// page.tsx は 'use client' なので、題名はこの layout で持つ。
// absolute にして、ルートの title.template による二重のサイト名を防ぐ（名前は旗に応じて ./brand が出し分ける）
export const metadata: Metadata = {
  title: { absolute: `ログイン｜${SITE_CONFIG.name}` },
  description: `${SITE_CONFIG.name}にログインします。Googleアカウントで、各ツールを使い始められます。`,
}

export default function SignInLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
