import type { Metadata } from 'next'
import DoyalistLayout from '@/components/doyalist/DoyalistLayout'

export const metadata: Metadata = {
  title: 'ドヤリスト | AI営業リスト + 営業文ツール',
  description: '業界・地域を選ぶだけでAIが営業リストを自動生成。フォーム営業文・メール文面・荷電スクリプトも1クリックで作成できます。',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <DoyalistLayout>{children}</DoyalistLayout>
}
