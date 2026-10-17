'use client'

// ドヤ収入管理 ダッシュボード（ログイン後のトップ）
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Info } from 'lucide-react'
import { todayJst } from '@/lib/income/dates'
import { Card, ErrorText, Loading, MonthSwitcher, StatTile, errMsg, fetchJson, monthLabel, yen } from '@/components/income/ui'

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
  const red = a.kind === 'leak' || a.kind === 'overdue'
  return (
    <li>
      <Link href={a.href} className="flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-2.5 hover:bg-slate-50">
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-black ${red ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
          {KIND_LABEL[a.kind] ?? '要確認'}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-black text-slate-900">{a.title}</span>
          <span className="block truncate text-xs font-bold text-slate-500">{a.detail}</span>
        </span>
        {a.amount !== null && <span className="shrink-0 text-sm font-black tabular-nums text-slate-800">{yen(a.amount)}</span>}
        <ArrowRight className="h-4 w-4 shrink-0 text-slate-300" />
      </Link>
    </li>
  )
}

function Onboarding() {
  const steps = [
    { n: 1, title: '設定で請求元（自社名・振込先）を登録', href: '/income/settings', cta: '設定を開く' },
    { n: 2, title: '取引先を登録', href: '/income/clients', cta: '取引先を開く' },
    { n: 3, title: '契約を登録 → 月ごとの売上予定が自動で作られます', href: '/income/contracts/new', cta: '契約を登録する' },
  ]
  return (
    <Card title="はじめに：3ステップで始められます">
      <ol className="space-y-2">
        {steps.map((s) => (
          <li key={s.n} className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50/50 px-3 py-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0f9f6e] text-sm font-black text-white">{s.n}</span>
            <span className="min-w-0 flex-1 text-sm font-black text-slate-800">{s.title}</span>
            <Link href={s.href} className="inline-flex items-center gap-1 text-xs font-black text-[#0f9f6e] hover:text-[#0b7f58]">
              {s.cta}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </li>
        ))}
      </ol>
    </Card>
  )
}

function TrendTable({ rows }: { rows: TrendRow[] }) {
  const max = Math.max(1, ...rows.map((r) => Math.max(r.revenue, r.received, r.expense ?? 0)))
  const bar = (v: number | null, color: string) => (
    <div className="h-1.5 rounded-full bg-slate-100">
      <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${v ? Math.max(2, Math.round((v / max) * 100)) : 0}%` }} />
    </div>
  )
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-xs">
        <thead>
          <tr className="border-b border-slate-200 text-left text-[11px] font-black text-slate-500">
            <th className="py-2 pr-3">月</th>
            <th className="py-2 pr-3">売上予定（税抜）</th>
            <th className="py-2 pr-3">入金</th>
            <th className="py-2 pr-3">支出</th>
            <th className="py-2 text-right">粗利</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.month} className="border-b border-slate-100 align-top">
              <td className="whitespace-nowrap py-2 pr-3 font-black text-slate-700">{monthLabel(r.month)}</td>
              <td className="py-2 pr-3"><div className="font-bold tabular-nums text-slate-900">{yen(r.revenue)}</div>{bar(r.revenue, 'bg-[#0f9f6e]')}</td>
              <td className="py-2 pr-3"><div className="font-bold tabular-nums text-slate-900">{yen(r.received)}</div>{bar(r.received, 'bg-sky-500')}</td>
              <td className="py-2 pr-3">
                <div className="font-bold tabular-nums text-slate-900">{r.expense === null ? '—' : yen(r.expense)}</div>
                {r.expense !== null && bar(r.expense, 'bg-amber-500')}
              </td>
              <td className={`py-2 text-right font-black tabular-nums ${r.profit !== null && r.profit < 0 ? 'text-red-600' : 'text-slate-900'}`}>{r.profit === null ? '—' : yen(r.profit)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function Dashboard() {
  const [month, setMonth] = useState(() => todayJst().slice(0, 7))
  const [data, setData] = useState<Summary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (m: string) => {
    setLoading(true)
    setError(null)
    try {
      setData(await fetchJson<Summary>(`/api/income/summary?month=${m}`))
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(month) }, [month, load])

  const k = data?.kpi
  const empty = !!data && k!.scheduled === 0 && k!.invoiced === 0 && k!.received === 0 && k!.unpaid === 0 && k!.scheduleCount === 0 && data.actions.length === 0

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-black text-slate-900 sm:text-2xl">{monthLabel(month)}の収入</h1>
        <MonthSwitcher month={month} onChange={setMonth} />
      </div>

      <ErrorText message={error} />
      {loading && !data && <Loading />}

      {data && k && (
        <div className={loading ? 'space-y-4 opacity-60 transition-opacity' : 'space-y-4'}>
          {empty && <Onboarding />}

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="売上予定（税抜）" value={yen(k.scheduled)} sub={`契約 ${k.scheduleCount} 件`} />
            <StatTile label="請求済（税抜）" value={yen(k.invoiced)} sub={`${k.invoicedCount} / ${k.scheduleCount} 件`} />
            <StatTile label="入金済" value={yen(k.received)} tone="green" />
            <StatTile label="未入金（税込）" value={yen(k.unpaid)} sub={`うち遅延 ${k.overdueCount} 件`} tone={k.overdueCount > 0 ? 'red' : 'default'} />
          </div>

          {data.expense.connected ? (
            <div className="space-y-1">
              <div className="grid grid-cols-2 gap-3">
                <StatTile label="支出" value={yen(k.expense)} sub={data.expense.workspaceName ? `取り込み元: ${data.expense.workspaceName}` : undefined} />
                <StatTile label="粗利（売上予定 - 支出）" value={yen(k.profit)} tone={k.profit !== null && k.profit < 0 ? 'red' : 'green'} />
              </div>
              <p className="text-[11px] font-bold text-slate-500">支出はドヤプロマネの記録（プロジェクト経費＋人件費）です</p>
            </div>
          ) : (
            <div className="flex items-start gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-600">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
              <p>
                支出が未接続です。設定でドヤプロマネのワークスペースを選ぶと、経費と人件費から粗利を出します。
                <Link href="/income/settings" className="ml-1 text-[#0f9f6e] underline hover:text-[#0b7f58]">設定を開く</Link>
              </p>
            </div>
          )}

          <Card title="要対応">
            {data.actions.length === 0 ? (
              <p className="text-sm font-bold text-slate-500">いま対応が必要なものはありません。</p>
            ) : (
              <ul className="space-y-2">{data.actions.map((a, i) => <ActionRow key={`${a.kind}-${i}`} a={a} />)}</ul>
            )}
          </Card>

          <Card title="月別推移（直近12か月）">
            <TrendTable rows={data.trend} />
          </Card>
        </div>
      )}
    </div>
  )
}
