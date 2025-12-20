import type { Metadata } from 'next'
import { DashboardLayout } from '@/components/DashboardLayout'

export const metadata: Metadata = {
  title: 'ドヤ記事作成',
  description: 'SEO + LLMOに強い長文記事を分割生成で安定作成するツール。',
}

export default function SeoLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardLayout>
      {children}
    </DashboardLayout>
  )
}
