import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'カンタンドヤAI - ビジネス文章自動生成',
  description: 'AIがビジネス文章を自動生成。メール、ブログ、SNS投稿など68種類のテンプレート。',
}

export default function KantanLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}

