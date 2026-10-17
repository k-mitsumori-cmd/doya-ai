import type { Metadata } from 'next'
import { buildServiceMetadata } from '@/lib/seo'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import ShanaiAppLayout from '@/components/shanai/ShanaiAppLayout'

// ⚠️ 開発中（UNLISTED_SERVICE_IDS）の間は noindex。公開するときに外す（reference/services/shanai.md）
export const metadata: Metadata = buildServiceMetadata('shanai', {
  tagline: '録音とアンケートから、会社の魅力が伝わる社員インタビュー記事を自動で作成',
  keywords: ['社員インタビュー 作成', '社員インタビュー AI', '採用広報 記事', '社内報 インタビュー', 'インタビュー 文字起こし 記事化'],
  noindex: true,
})

export default async function ShanaiLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  // ⚠️ 未ログインをアプリ枠で包まない（空のサイドバーが出る）。社員が開く回答画面もアプリ枠の外（guest-path.ts）
  return session?.user ? <ShanaiAppLayout>{children}</ShanaiAppLayout> : <>{children}</>
}
