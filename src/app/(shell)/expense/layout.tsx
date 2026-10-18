import type { Metadata } from 'next'
import { buildServiceMetadata } from '@/lib/seo'

// ⚠️ 開発中の間は noindex。公開するときに外す
export const metadata: Metadata = buildServiceMetadata('expense', {
  tagline: 'SaaS、業務委託、家賃などの支払いを契約ごとに登録し、12か月先までの出金を見える化します',
  keywords: ['支出管理', '業務委託 支払管理', '源泉徴収 管理', 'サブスク 管理', '資金繰り 予測'],
  noindex: true,
})

export default function ExpenseLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
