// 開発用の確認ページ: ドヤくんの共通部品（ds/kun）と、動きの部品（RevealWords）・生成中の帯を並べて見る
// ⚠️ 本番（NODE_ENV=production）では 404。DB・AI・ログインには触れない
import { notFound } from 'next/navigation'
import AppShell from '@/components/shell/AppShell'
import KunPreviewBody from './KunPreviewBody'

export const dynamic = 'force-dynamic'

export default function KunPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound()
  return (
    <AppShell userName="見本">
      <KunPreviewBody />
    </AppShell>
  )
}
