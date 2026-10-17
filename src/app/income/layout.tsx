import type { Metadata } from 'next'
import { buildServiceMetadata } from '@/lib/seo'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import IncomeAppLayout from '@/components/income/IncomeAppLayout'

// ⚠️ 開発中（UNLISTED_SERVICE_IDS）の間は noindex。公開するときに外す
export const metadata: Metadata = buildServiceMetadata('income', {
  tagline: '契約から毎月の売上・請求書・入金まで。請求漏れを出さないB2Bの収入管理',
  keywords: ['収入管理', '請求書 管理', '入金管理 ツール', '売上管理 B2B', '請求漏れ 防止'],
  noindex: true,
})

export default async function IncomeLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  // ⚠️ 未ログインをアプリ枠で包まない（空のサイドバーが出る）
  return session?.user ? <IncomeAppLayout>{children}</IncomeAppLayout> : <>{children}</>
}
