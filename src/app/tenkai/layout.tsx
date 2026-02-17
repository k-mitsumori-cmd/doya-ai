import type { Metadata } from 'next'
import TenkaiLayout from '@/components/tenkai/TenkaiLayout'

export const metadata: Metadata = {
  title: 'ドヤ展開AI | 1コンテンツ→9プラットフォーム自動変換',
  description: '1つのコンテンツを9プラットフォームに最適化して自動変換。note, Blog, X, Instagram, LINE, Facebook, LinkedIn, メルマガ, プレスリリースに対応。',
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <TenkaiLayout>{children}</TenkaiLayout>
}
