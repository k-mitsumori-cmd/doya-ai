// ============================================
// プロマネのプロジェクト一覧（新しい見た目）
// ============================================
// isUiNext() が真のときだけ、src/app/(shell)/promane/[workspaceSlug]/projects/page.tsx から出す。偽のときは今までの画面のまま。
// ⚠️ 集計は page.tsx のまま。ここは受け取った値を並べるだけ。
// ⚠️ 目立たせるのは案件名と収支。顧客が未設定なら薄い「—」にする（UI 品質 S-50）。375px では2列の札にする（固定幅の列を置かない）。
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Button, Card, EmptyState, StatTile } from '@/components/ds'
import { formatCurrency, profitTone, PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS } from '@/lib/promane/format'
import { manYen, PROMANE_UI_NEXT_ART } from '@/components/promane/ui-next-art'

const PROFIT_TEXT = { positive: 'text-emerald-700', negative: 'text-rose-700', zero: 'text-slate-500' } as const

type Row = {
  id: string
  name: string
  status: string
  endDate: Date | string | null
  contractAmount: number
  client?: { name: string } | null
  profit: number
  profitRate: number
  assignees: string[]
}

export default function ProjectsNext({ workspaceSlug, rows, activeCount, totalRevenue, avgProfitRate }: {
  workspaceSlug: string
  rows: Row[]
  activeCount: number
  totalRevenue: number
  avgProfitRate: number
}) {
  const base = `/promane/${workspaceSlug}`
  const newHref = `${base}/projects/new`

  return (
    <div className="mx-auto max-w-[1300px] space-y-6 px-4 py-6 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-slate-900">プロジェクト一覧</h2>
          <p className="mt-1 text-sm text-slate-600">案件ごとの予算・進み具合・利益率を並べます。</p>
        </div>
        <Button href={newHref} icon="Plus">新規プロジェクト</Button>
      </div>

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            title="まだプロジェクトはありません"
            description="顧客・予算・期間を入れてプロジェクトをつくると、ここで収支と進み具合を比べられます。"
            art={PROMANE_UI_NEXT_ART.empty}
            action={<Button href={newHref} icon="Plus">最初のプロジェクトをつくる</Button>}
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            <StatTile label="プロジェクト" value={rows.length} unit="件" icon="FolderKanban" />
            <StatTile label="進行中" value={activeCount} unit="件" icon="Timer" />
            <StatTile label="売上（契約額）" value={manYen(totalRevenue)} unit="円" icon="BadgeJapaneseYen" />
            <StatTile label="平均の利益率" value={avgProfitRate} unit="%" icon="LineChart" />
          </div>

          <Card title="すべてのプロジェクト" meta={`${rows.length}件`}>
            <div className="-mx-2 hidden grid-cols-[minmax(0,4fr)_minmax(0,2fr)_minmax(0,1fr)_minmax(0,2fr)_minmax(0,2fr)] gap-3 border-b border-slate-100 px-2 pb-2 text-xs font-bold text-slate-500 md:grid">
              <span>プロジェクト・顧客</span>
              <span>状態</span>
              <span className="text-right">期日</span>
              <span className="text-right">予算</span>
              <span className="text-right">利益率</span>
            </div>
            <ul className="-mx-2 divide-y divide-slate-100">
              {rows.map((p) => {
                const tone = profitTone(p.profit)
                const due = p.endDate ? new Date(p.endDate).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' }) : null
                return (
                  <li key={p.id}>
                    <Link
                      href={`${base}/projects/${p.id}`}
                      className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-lg px-2 py-3 hover:bg-slate-50 md:grid-cols-[minmax(0,4fr)_minmax(0,2fr)_minmax(0,1fr)_minmax(0,2fr)_minmax(0,2fr)]"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[15px] font-bold text-slate-900 group-hover:text-blue-700">{p.name}</span>
                        <span className={`block truncate text-xs ${p.client?.name ? 'text-slate-500' : 'text-slate-300'}`}>
                          {p.client?.name || '—'}
                          {p.assignees.length > 0 ? <span className="text-slate-400">・担当 {p.assignees.slice(0, 3).join('、')}{p.assignees.length > 3 ? ` ほか${p.assignees.length - 3}名` : ''}</span> : null}
                        </span>
                      </span>
                      {/* 375px: 右に予算と利益率。md 以上: 列にそろえる */}
                      <span className="text-right md:hidden">
                        <span className="block whitespace-nowrap text-sm font-bold tabular-nums text-slate-900">{formatCurrency(p.contractAmount)}</span>
                        <span className={`block whitespace-nowrap text-xs font-semibold tabular-nums ${p.contractAmount > 0 ? PROFIT_TEXT[tone] : 'text-slate-300'}`}>
                          {p.contractAmount > 0 ? `利益率 ${Math.round(p.profitRate)}%` : '—'}
                        </span>
                      </span>
                      <span className="col-span-2 flex items-center gap-2 text-xs md:col-span-1">
                        <span className={`whitespace-nowrap rounded-full px-2 py-0.5 font-semibold ${PROJECT_STATUS_COLORS[p.status] ?? 'bg-slate-100 text-slate-700'}`}>{PROJECT_STATUS_LABELS[p.status] ?? p.status}</span>
                        <span className="whitespace-nowrap tabular-nums text-slate-500 md:hidden">{due ? `期日 ${due}` : ''}</span>
                      </span>
                      <span className={`hidden whitespace-nowrap text-right text-sm tabular-nums md:block ${due ? 'text-slate-700' : 'text-slate-300'}`}>{due ?? '—'}</span>
                      <span className="hidden whitespace-nowrap text-right text-sm font-bold tabular-nums text-slate-900 md:block">{formatCurrency(p.contractAmount)}</span>
                      <span className={`hidden items-center justify-end gap-1 whitespace-nowrap text-sm font-bold tabular-nums md:flex ${p.contractAmount > 0 ? PROFIT_TEXT[tone] : 'text-slate-300'}`}>
                        {p.contractAmount > 0 ? `${Math.round(p.profitRate)}%` : '—'}
                        <ArrowRight size={14} aria-hidden className="text-slate-300 group-hover:text-blue-600" />
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </Card>
        </>
      )}
    </div>
  )
}
