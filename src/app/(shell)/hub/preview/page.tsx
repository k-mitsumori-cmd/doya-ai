// 開発用プレビュー: 製品の切り替えと製品のホームを表示する（ログイン・DB不要）
// ⚠️ 本番（VERCEL_ENV=production）では 404。Vercel のプレビューと手元では開ける。画面確認・デザイン調整のためだけに使う。数字は見本（画面の上に「見本の数字」と出す）
// 例: /hub/preview?p=sales ・ /hub/preview?p=budget
import { notFound } from 'next/navigation'
import AppShell from '@/components/shell/AppShell'
import { parseProductId, type ProductId } from '@/lib/products'
import type { HubMetric } from '@/lib/products/hub-metrics'
import HubView from '../HubView'

export const dynamic = 'force-dynamic'

const SAMPLE: Record<ProductId, HubMetric[]> = {
  sales: [
    { key: 'won', label: '今月の受注', value: '320万円', sub: '4件', href: '/sfa', state: 'ready' },
    { key: 'pipeline', label: '進行中の商談', value: '1,280万円', sub: '12件・見込み 540万円', href: '/sfa', state: 'ready' },
    { key: 'quotes', label: '今月確定した見積', value: '210万円', sub: '下書き 3件・送付済み 5件', href: '/quote', state: 'ready' },
    { key: 'tasks', label: '期限切れのタスク', value: '2件', sub: '未完了 9件', href: '/sfa', state: 'ready' },
  ],
  budget: [
    { key: 'revenue', label: '今月の売上（実 / 予）', value: '180万円 / 240万円', sub: '入金済みの割合 75%', href: '/income', state: 'ready' },
    { key: 'unpaid', label: '入金待ち', value: '60万円', sub: '期日を過ぎた請求 1件', href: '/income', state: 'ready' },
    { key: 'spend', label: '今月の支払い（実 / 予）', value: '92万円 / 130万円', sub: '来月の予定 128万円', href: '/expense', state: 'ready' },
    { key: 'projects', label: '案件の利益', value: '—', href: '/promane', state: 'empty' },
  ],
  hr: [
    { key: 'people', label: '在籍している社員', value: '24人', sub: '部署 5', href: '/hr/dashboard', state: 'ready' },
    { key: 'overtime', label: '今月の残業', value: '38.5時間', sub: '働いた時間 2,110時間', href: '/kintai/dashboard', state: 'ready' },
    { key: 'requests', label: '承認待ちの申請', value: '3件', href: '/kintai/dashboard', state: 'ready' },
  ],
  marketing: [],
  management: [],
}

export default async function HubPreviewPage(props: { searchParams?: Promise<{ p?: string }> }) {
  if (process.env.VERCEL_ENV === 'production') notFound()
  const id = parseProductId((await props.searchParams)?.p) ?? 'sales'
  return (
    <AppShell userName="サンプル" agentTasks products={{ enabled: true, start: id, selfDefault: null }}>
      <p style={{ margin: 0, padding: '8px 16px', background: '#fff7d6', color: '#7a5b00', fontSize: 13, fontWeight: 700 }}>開発用の見本です。数字は見本の数字で、実際のデータではありません。</p>
      <HubView productId={id} metrics={SAMPLE[id]} />
    </AppShell>
  )
}
