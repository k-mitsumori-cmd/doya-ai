import type { Metadata } from 'next'
import HrLayout from '@/components/hr/HrLayout'

export const metadata: Metadata = {
  title: 'ドヤHR | 人を活かすAI',
  description: '中小企業のためのAIタレントマネジメントシステム',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <HrLayout>{children}</HrLayout>
}
