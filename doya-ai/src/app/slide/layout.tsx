import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'ドヤスライド - AIで提案資料を爆速生成',
  description:
    'GeminiのAIで提案資料・営業資料・ミーティング資料・採用資料を自動生成。Googleスライドでそのまま編集可能。',
}

export default function SlideLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}

