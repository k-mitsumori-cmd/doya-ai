import type { Metadata } from 'next'
import DoyalistLayout from '@/components/doyalist/DoyalistLayout'

export const metadata: Metadata = {
  title: 'ドヤリストAI | AI営業リスト自動作成',
  description: 'AIが最適なターゲット企業を自動で見つけて営業リストを作成。企業分析・スコアリング・アプローチ文面生成まで一気通貫。',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <DoyalistLayout>{children}</DoyalistLayout>
}
