'use client'

// ドヤ収入管理 ダッシュボード（ログイン後のトップ）
import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { todayJst } from '@/lib/income/dates'
import {
  Button, Card, EmptyState, Gate, ListSkeleton, MonthSwitcher, PageHeader, PageShell, StatTile, StatsSkeleton, Skeleton,
  fetchJson, monthLabel, num, s, useResource, yen,
} from '@/components/income/ui'
import { IncomeHero, OnboardingSteps, TrendChart, YenCount } from '@/components/income/next'
import { useUiNext } from '@/components/shell/ui-next-context'

type Action = { kind: string; title: string; detail: string; amount: number | null; href: string; dueOn: string }
type TrendRow = { month: string; revenue: number; received: number; expense: number | null; profit: number | null }
type Summary = {
  month: string
  kpi: {
    scheduled: number; invoiced: number; received: number; unpaid: number; overdueCount: number
    scheduleCount: number; invoicedCount: number; expense: number | null; profit: number | null
  }
  expense: { connected: boolean; workspaceName?: string | null; reason?: string }
  actions: Action[]
  trend: TrendRow[]
}

const KIND_LABEL: Record<string, string> = { leak: '請求漏れ', overdue: '入金遅延', draft_contract: '未確定', renewal: '更新期限', contract_end: '契約終了' }

function ActionRow({ a }: { a: Action }) {
  const bad = a.kind === 'leak' || a.kind === 'overdue'
  return (
    <li>
      <Link href={a.href} className={s.lineRow} style={{ flexWrap: 'nowrap', gap: 12 }}>
        <span className={`${s.badge} ${bad ? s.bBad : s.bNote}`} style={{ flex: 'none' }}>{KIND_LABEL[a.kind] ?? '要確認'}</span>
        <span className={s.grow}>
          <span className={`${s.truncate} ${s.strong}`} style={{ display: 'block' }}>{a.title}</span>
          <span className={`${s.truncate} ${s.sub}`} style={{ display: 'block' }}>{a.detail}</span>
        </span>
        {a.amount !== null && <span className={`${s.num} ${s.strong}`} style={{ flex: 'none' }}>{yen(a.amount)}</span>}
        <ArrowRight size={16} aria-hidden="true" style={{ flex: 'none', color: 'var(--muted)' }} />
      </Link>
    </li>
  )
}

function Onboarding() {
  const steps = [
    { n: 1, title: '設定で請求元（自社名・振込先）を登録する', href: '/income/settings', cta: '設定を開く' },
    { n: 2, title: '取引先を登録する', href: '/income/clients', cta: '取引先を開く' },
    { n: 3, title: '契約を登録すると、月ごとの売上予定が自動で作られます', href: '/income/contracts/new', cta: '契約を登録する' },
  ]
  return (
    <div className={s.stackY}>
      <EmptyState
        image="/ui-renewal/mascots/income.webp"
        message="まだ売上予定がありません。請求元、取引先、契約の順に登録すると、この画面に毎月の収入が出ます。"
        action={{ label: '設定を開く', href: '/income/settings' }}
      />
      <Card title="はじめの3ステップ">
        <ol className="m-0 list-none space-y-3 p-0">
          {steps.map((st) => (
            <li key={st.n} className="flex flex-wrap items-center gap-3">
              <span className={`${s.badge} ${s.bInfo} ${s.num}`} aria-hidden="true">{st.n}</span>
              <span className="min-w-0 flex-1">{st.title}</span>
              <Link href={st.href} className={s.link}>{st.cta}</Link>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  )
}

function TrendTable({ rows }: { rows: TrendRow[] }) {
  const max = Math.max(1, ...rows.map((r) => Math.max(r.revenue, r.received, r.expense ?? 0)))
  const bar = (v: number | null, fill: string) => (
    <div className={s.bar}><div className={s.barFill} style={{ width: `${v ? Math.max(2, Math.round((v / max) * 100)) : 0}%`, background: fill }} /></div>
  )
  return (
    <div className={s.tableWrap}>
      <table className={`${s.table} ${s.tableMid}`}>
        <thead>
          <tr><th>月</th><th>売上予定（税抜）</th><th>入金</th><th>支出</th><th className={s.r}>粗利</th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.month}>
              <td data-label="月" className={s.strong} style={{ whiteSpace: 'nowrap' }}>{monthLabel(r.month)}</td>
              <td data-label="売上予定（税抜）"><div className={s.cellBar}><div>{yen(r.revenue)}</div>{bar(r.revenue, 'var(--blue)')}</div></td>
              <td data-label="入金"><div className={s.cellBar}><div>{yen(r.received)}</div>{bar(r.received, 'var(--navy)')}</div></td>
              <td data-label="支出">
                <div className={s.cellBar}><div>{r.expense === null ? '—' : yen(r.expense)}</div>{r.expense !== null && bar(r.expense, 'var(--muted)')}</div>
              </td>
              <td data-label="粗利" className={`${s.r} ${s.strong} ${r.profit !== null && r.profit < 0 ? s.badText : ''}`}>{r.profit === null ? '—' : yen(r.profit)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className={s.stackY}>
      <StatsSkeleton />
      <div className={s.card} style={{ display: 'grid', gap: 8 }}><Skeleton w="20%" h={18} /><Skeleton h={44} /><Skeleton h={44} /></div>
      <ListSkeleton rows={2} />
    </div>
  )
}

export default function Dashboard() {
  const [month, setMonth] = useState(() => todayJst().slice(0, 7))
  const res = useResource(() => fetchJson<Summary>(`/api/income/summary?month=${month}`), month)
  // 新しい見た目（キービジュアル・数字の動き・グラフ）は、許可した人だけに出す（チェックリスト §5.1）
  const uiNext = useUiNext()
  const n = (v: number | null) => (uiNext ? <YenCount value={v} /> : num(v))

  return (
    <PageShell>
      {uiNext && <IncomeHero />}
      <PageHeader title={`${monthLabel(month)}の収入`} sub="売上予定・請求・入金を月ごとに確認します" actions={<MonthSwitcher month={month} onChange={setMonth} />} />
      <Gate res={res} skeleton={<DashboardSkeleton />}>
        {(data) => {
          const k = data.kpi
          const empty = k.scheduled === 0 && k.invoiced === 0 && k.received === 0 && k.unpaid === 0 && k.scheduleCount === 0 && data.actions.length === 0
          return (
            <div className={s.stackY} style={{ opacity: res.loading ? 0.6 : 1, transition: 'opacity .2s' }}>
              {empty && (uiNext ? <OnboardingSteps /> : <Onboarding />)}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatTile label="売上予定（税抜）" value={n(k.scheduled)} unit="円" sub={`契約 ${k.scheduleCount} 件`} />
                <StatTile label="請求済（税抜）" value={n(k.invoiced)} unit="円" sub={`${k.invoicedCount} / ${k.scheduleCount} 件`} />
                <StatTile label="入金済" value={n(k.received)} unit="円" tone="ok" />
                <StatTile label="未入金（税込）" value={n(k.unpaid)} unit="円" sub={`うち遅延 ${k.overdueCount} 件`} tone={k.overdueCount > 0 ? 'bad' : 'default'} />
              </div>

              {data.expense.connected ? (
                <div className={s.stackY} style={{ gap: 8 }}>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <StatTile label="支出" value={n(k.expense)} unit="円" sub={data.expense.workspaceName ? `取り込み元: ${data.expense.workspaceName}` : undefined} />
                    <StatTile label="粗利（売上予定 - 支出）" value={n(k.profit)} unit="円" tone={k.profit !== null && k.profit < 0 ? 'bad' : 'ok'} />
                  </div>
                  <p className={s.sub} style={{ margin: 0 }}>支出はドヤプロマネの記録（プロジェクト経費＋人件費）です。</p>
                </div>
              ) : (
                <div className={s.info}>
                  <p style={{ margin: '0 0 8px' }}>支出が未接続です。設定でドヤプロマネのワークスペースを選ぶと、経費と人件費から粗利を出します。</p>
                  <Button href="/income/settings" size="sm">設定を開く</Button>
                </div>
              )}

              <Card title="要対応">
                {data.actions.length === 0 ? (
                  <p style={{ margin: 0, color: 'var(--sub)' }}>いま対応が必要なものはありません。</p>
                ) : (
                  <ul className={s.divided}>{data.actions.map((a, i) => <ActionRow key={`${a.kind}-${i}`} a={a} />)}</ul>
                )}
              </Card>

              <Card title="月別推移（直近12か月）">
                {uiNext && <div style={{ marginBottom: 16 }}><TrendChart rows={data.trend} /></div>}
                <TrendTable rows={data.trend} />
              </Card>
            </div>
          )
        }}
      </Gate>
    </PageShell>
  )
}
