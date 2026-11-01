// 開発用プレビュー: 共通シェル（AppShell＋ToolFrame）と ds 部品の見本（ログイン・DB不要）
// ⚠️ 本番では 404。段0の画面確認（375px / 768px / 1280px）とデザイン調整のためだけに使う。
import { notFound } from 'next/navigation'
import DsPreview from './DsPreview'

export const dynamic = 'force-dynamic'

export default function DsPreviewPage() {
  if (process.env.NODE_ENV === 'production' && process.env.DS_PREVIEW !== '1') notFound()
  return <DsPreview />
}
