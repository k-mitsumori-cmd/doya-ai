import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'ドヤバナーAI - プロ品質バナー自動生成',
  description: 'AIがプロ品質のバナーを自動生成。A/B/Cの3案を同時生成。',
}

export default function BannerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}

