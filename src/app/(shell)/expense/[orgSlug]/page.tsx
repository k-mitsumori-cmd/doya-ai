'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'
import { useExpenseQuery } from '@/components/expense/api'
import type { ForecastMatrix, Schedule } from '@/components/expense/types'
import CashBars from '@/components/expense/CashBars'
import { Button as DsButton, StatTile } from '@/components/ds'
import { ExpenseHero, MonthDonut, YenCount } from '@/components/expense/next'
import { Badge, Card, EmptyState, ErrorBox, Loading, PageBody, StatusBadge, addMonths, currentYm, fmtMonthDay, fmtMonthLabel, formatYen, todayYmd, type Tone, useExpenseOrg } from '@/components/expense/ui'

interface ActionItem { kind: string; scheduleId: string; title: string; dueOn: string; amount: number; detail: string }
interface ContractAlert { kind: string; contractId: string; title: string; dueOn: string; detail: string }
interface Summary {
  month: string
  kpi: { thisMonthOut: number; thisMonthCount: number; paid: number; paidCount: number; fixedMonthly: number; saasMonthly: number; saasCount: number }
  actionItems: ActionItem[]
  contractAlerts: ContractAlert[]
  cash: ForecastMatrix
  contractCount: number
}

const ACTION_LABEL: Record<string, { label: string; tone: Tone }> = {
  bill_missing: { label: '請求書待ち', tone: 'amber' },
  overdue: { label: '支払日超過', tone: 'red' },
  amount_diff: { label: '金額差異', tone: 'blue' },
  withholding_due: { label: '源泉税の納付', tone: 'red' },
  renewal: { label: '更新期限', tone: 'amber' },
  contract_end: { label: '契約終了', tone: 'amber' },
}

function Kpi({ label, value, sub, count }: { label: string; value: number; sub?: string; count?: boolean }) {
  return <StatTile label={label} value={count ? <YenCount value={value} /> : value.toLocaleString('ja-JP')} unit="円" sub={sub} />
}

export default function DashboardPage() {
  const { orgSlug } = useParams() as { orgSlug: string }
  const base = `/expense/${orgSlug}`
  const ym = currentYm()
  // 新しい見た目（キービジュアル・数字の動き・割合の円）は、許可した人だけに出す（チェックリスト §5.1）
  const { canManage } = useExpenseOrg()
  const summary = useExpenseQuery<Summary>('/api/expense/summary', orgSlug)
  const thisM = useExpenseQuery<{ schedules: Schedule[] }>(`/api/expense/schedules?month=${ym}`, orgSlug)
  const nextM = useExpenseQuery<{ schedules: Schedule[] }>(`/api/expense/schedules?month=${addMonths(ym, 1)}`, orgSlug)

  const today = todayYmd()
  const limit = new Date(Date.parse(today) + 14 * 86400000).toISOString().slice(0, 10)
  const upcoming = [...(thisM.data?.schedules ?? []), ...(nextM.data?.schedules ?? [])]
    .filter((s) => s.status !== 'paid' && s.status !== 'skipped' && s.plannedPayDate >= today && s.plannedPayDate <= limit)
    .sort((a, b) => a.plannedPayDate.localeCompare(b.plannedPayDate))

  if (summary.loading && !summary.data) return <PageBody><Loading kpi /></PageBody>
  if (summary.error || !summary.data) return <PageBody><ErrorBox forbidden={summary.forbidden} onRetry={summary.reload} /></PageBody>
  const s = summary.data
  const todo = s.actionItems.length + s.contractAlerts.length

  return (
    <PageBody>
      <ExpenseHero
          month={fmtMonthLabel(s.month)}
          contractCount={s.contractCount}
          action={canManage
            ? <DsButton href={`${base}/contracts/new`} icon="Plus">契約を登録する</DsButton>
            : <DsButton href={`${base}/payables`} icon="CalendarDays">支払予定を見る</DsButton>}
        />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi count={true} label="今月の出金予定" value={s.kpi.thisMonthOut} sub={`${s.kpi.thisMonthCount} 件`} />
        <Kpi count={true} label="支払済" value={s.kpi.paid} sub={`${s.kpi.paidCount} 件 / ${s.kpi.thisMonthCount} 件`} />
        <Kpi count={true} label="固定費（月額）" value={s.kpi.fixedMonthly} sub="有効な契約の月額換算" />
        <Kpi count={true} label="SaaS 合計" value={s.kpi.saasMonthly} sub={`${s.kpi.saasCount} サービス`} />
      </div>

      <Card className="mt-4">
        <h2 className="mb-3 flex items-center gap-2 text-[18px] font-bold text-[var(--ink)]">
          <AlertTriangle className="h-4 w-4 text-[var(--note-ink)]" />
          要対応
          <span className="text-xs font-bold text-[var(--muted)]">{todo} 件</span>
        </h2>
        {todo === 0 ? (
          <p className="py-4 text-center text-sm font-bold text-[var(--muted)]">いま対応が必要なものはありません。</p>
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {s.actionItems.map((a) => (
              <li key={a.scheduleId + a.kind} className="flex flex-wrap items-center gap-2 py-2">
                <Badge tone={ACTION_LABEL[a.kind]?.tone ?? 'slate'}>{ACTION_LABEL[a.kind]?.label ?? a.kind}</Badge>
                <Link href={`${base}/payables?month=${a.dueOn.slice(0, 7)}`} className="text-sm font-bold text-[var(--ink)] hover:text-[var(--blue)]">{a.title}</Link>
                <span className="text-xs font-bold text-[var(--sub)]">{a.detail}</span>
                <span className="ml-auto text-sm font-bold text-[var(--ink)]">{formatYen(a.amount)}</span>
              </li>
            ))}
            {s.contractAlerts.map((a) => (
              <li key={a.contractId + a.kind} className="flex flex-wrap items-center gap-2 py-2">
                <Badge tone={ACTION_LABEL[a.kind]?.tone ?? 'slate'}>{ACTION_LABEL[a.kind]?.label ?? a.kind}</Badge>
                <Link href={`${base}/contracts/${a.contractId}`} className="text-sm font-bold text-[var(--ink)] hover:text-[var(--blue)]">{a.title}</Link>
                <span className="text-xs font-bold text-[var(--sub)]">{a.detail}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mt-4">
        <h2 className="mb-3 text-[18px] font-bold text-[var(--ink)]">12か月の出金（カテゴリ別）</h2>
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div className="min-w-0"><CashBars cash={s.cash} /></div>
            <div className="min-w-0">
              <p className="mb-2 text-[13px] font-medium text-[var(--sub)]">今月の内訳</p>
              <MonthDonut cash={s.cash} month={s.month} />
            </div>
          </div>
      </Card>

      <Card className="mt-4">
        <h2 className="mb-3 text-[18px] font-bold text-[var(--ink)]">今後14日の支払</h2>
        {thisM.loading || nextM.loading ? (
          <Loading rows={2} />
        ) : upcoming.length === 0 ? (
          <EmptyState image="/expense/empty-calendar.webp" alt="今後14日の支払予定は空です" text="今後14日に払う予定はありません。" actionLabel="支払予定を見る" href={`${base}/payables`} />
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {upcoming.map((u) => (
              <li key={u.id} className="flex items-center gap-3 py-2">
                <span className="w-12 text-sm font-bold text-[var(--sub)]">{fmtMonthDay(u.plannedPayDate)}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-bold text-[var(--ink)]">{u.title}</span>
                <StatusBadge status={u.status} />
                <span className="w-28 text-right text-sm font-bold text-[var(--ink)]">{formatYen(u.netPayAmount)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </PageBody>
  )
}
