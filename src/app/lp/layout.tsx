import type { Metadata } from 'next'
import LpAppLayout from '@/components/LpAppLayout'

export const metadata: Metadata = {
  title: 'ドヤLP AI | LPを、1分で設計する。',
  description: '商品情報を入力するだけで、LP構成案・セクション別コピー・デザイン方針をAIが自動生成。HTMLエクスポートで、そのまま公開or制作会社への指示書として使用。',
}

export default function LpLayout({ children }: { children: React.ReactNode }) {
  return <LpAppLayout>{children}</LpAppLayout>
}
