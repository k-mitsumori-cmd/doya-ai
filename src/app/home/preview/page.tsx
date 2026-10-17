// 開発用プレビュー: 経営ホームをサンプルの数字で表示する（ログイン・DB不要）
// ⚠️ 本番では 404。画面確認・デザイン調整のためだけに使う。
import { notFound } from 'next/navigation'
import AppShell from '@/components/shell/AppShell'
import type { HomeSummary } from '@/lib/home/summary'
import HomeDashboard from '../HomeDashboard'

export const dynamic = 'force-dynamic'

function sample(): HomeSummary {
  const now = new Date()
  const day = (d: number) => new Date(now.getTime() + d * 86400_000).toISOString()
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const won = [2_400_000, 3_100_000, 2_800_000, 4_200_000, 3_900_000, 2_650_000]
  const quoted = [2_900_000, 3_300_000, 3_600_000, 4_000_000, 4_500_000, 3_200_000]
  return {
    generatedAt: now.toISOString(),
    user: { name: 'サンプル', email: null },
    contract: { tier: 'PRO', label: 'プロ', paid: true, status: 'active', currentPeriodEnd: day(19), cancelAtPeriodEnd: false },
    sales: {
      state: 'ready', orgName: 'サンプル株式会社', href: '/sfa/sample',
      wonThisMonth: 2_650_000, wonCountThisMonth: 4, openPipeline: 18_400_000, weightedPipeline: 7_820_000, openDeals: 23,
      stages: [
        { name: 'アポ', amount: 6_200_000, count: 9, color: '#93c5fd' },
        { name: 'ヒアリング', amount: 5_100_000, count: 7, color: '#60a5fa' },
        { name: '提案', amount: 4_300_000, count: 5, color: '#3b82f6' },
        { name: '最終交渉', amount: 2_800_000, count: 2, color: '#2563eb' },
      ],
      openTasks: 14, overdueTasks: 3, newLeads: 31,
    },
    quotes: { state: 'ready', orgName: 'サンプル株式会社', href: '/quote', confirmedThisMonth: 3_200_000, draftCount: 5, sentCount: 8 },
    projects: {
      state: 'ready', href: '/promane/sample/reports', activeProjects: 6, revenue: 12_600_000, cost: 8_150_000, profit: 4_450_000, openTasks: 42,
      top: [
        { name: 'コーポレートサイト刷新', revenue: 4_800_000, profit: 1_900_000 },
        { name: '採用LP制作', revenue: 2_400_000, profit: 820_000 },
        { name: '広告運用（10月）', revenue: 1_800_000, profit: 610_000 },
        { name: '営業資料の改訂', revenue: 900_000, profit: -120_000 },
      ],
    },
    attendance: { state: 'ready', href: '/kintai/dashboard', scope: 'org', workHoursThisMonth: 1824.5, overtimeHoursThisMonth: 96, pendingRequests: 2, employees: 14 },
    people: { state: 'ready', href: '/hr/dashboard', activeEmployees: 14, departments: 4 },
    trend: months.map((m, i) => ({ month: m, won: won[i], quoted: quoted[i] })),
    events: [
      { id: 'a', date: day(0), title: '提案書の最終確認', kind: 'task', href: '/sfa/sample/tasks' },
      { id: 'b', date: day(2), title: '受注予定: 東和商事 年間契約', kind: 'deal', href: '/sfa/sample/deals' },
      { id: 'c', date: day(5), title: '見積の有効期限: Webサイト保守', kind: 'quote', href: '/quote' },
      { id: 'd', date: day(9), title: '納期: 採用LP制作', kind: 'project', href: '/promane/sample/projects' },
    ],
  }
}

export default function HomePreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound()
  return (
    <AppShell userName="サンプル">
      <HomeDashboard initial={sample()} />
    </AppShell>
  )
}
