// ============================================
// プロマネのダッシュボード（新しい見た目）
// ============================================
// isUiNext() が真のときだけ、src/app/(shell)/promane/[workspaceSlug]/page.tsx から出す。偽のときは今までの画面のまま。
// ⚠️ データの取り方は page.tsx のまま。ここは受け取った値を並べるだけ。
// ⚠️ 見出し（h1）は枠（ToolFrame）が持つ。ここでは h2 から始める（UI 品質 S-57）。
// ⚠️ 絵文字をアイコンにしない（lucide）。375px で横にはみ出さない（固定幅の列を置かない）。
import Link from 'next/link'
import { ArrowRight, CheckCircle2, CircleDashed, FolderOpen, ListChecks, Loader } from 'lucide-react'
import { Badge, Button, Card, EmptyState, FirstSteps, StatTile, ToolHero } from '@/components/ds'
import { formatCurrency, formatPercent, profitLabel, profitTone, PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS } from '@/lib/promane/format'
import { TaskPieChart, RevenueLineChart, ProfitBarChart } from '@/components/promane/dashboard-charts'
import { PROMANE_UI_NEXT_ART } from '@/components/promane/ui-next-art'

const ROLE_LABELS: Record<string, string> = { owner: 'オーナー', admin: '管理者', member: 'メンバー', guest: 'ゲスト' }

const TASK_STATUS: Record<string, { label: string; tone: 'neutral' | 'blue' | 'ok' | 'note' }> = {
  todo: { label: 'やること', tone: 'neutral' },
  in_progress: { label: '進行中', tone: 'blue' },
  review: { label: 'レビュー', tone: 'note' },
  done: { label: '完了', tone: 'ok' },
}

const PROFIT_TEXT = { positive: 'text-emerald-700', negative: 'text-rose-700', zero: 'text-slate-500' } as const

type ProjectStat = {
  id: string
  name: string
  status: string
  client?: { name: string } | null
  revenue: number
  profit: number
  profitRate: number
  progress: number
}

export default function DashboardNext({ workspaceSlug, data, myData, chartData, myMember }: {
  workspaceSlug: string
  data: { projectStats: ProjectStat[]; activeProjects: number; totalRevenue: number; totalCost: number; totalProfit: number; totalProfitRate: number }
  myData: { tasks: any[]; myProjects: { id: string; name: string; taskCount: number }[] }
  chartData: { taskSummary: any[]; revenueData: any[]; activities: any[] }
  myMember?: { role: string; displayName: string } | null
}) {
  const base = `/promane/${workspaceSlug}`
  const newHref = `${base}/projects/new`
  const empty = data.projectStats.length === 0
  const tone = profitTone(data.totalProfit)

  return (
    <div className="mx-auto max-w-[1200px] space-y-6 px-4 py-6 sm:px-8">
      <ToolHero
        title="案件の進み具合と収支を、ひと目で"
        lead="タスク・工数・売上をワークスペースにまとめ、赤字になりそうな案件を早めに見つけます。"
        action={<Button href={newHref} icon="Plus">新規プロジェクト</Button>}
        art={PROMANE_UI_NEXT_ART.hero}
      />

      {empty ? (
        <>
          <FirstSteps
            id="promane"
            steps={[
              { title: 'プロジェクトをつくる', body: '顧客・予算・期間を入れます。顧客はあとから足せます。' },
              { title: 'タスクを分けて担当を決める', body: 'かんばんで進み具合を動かします。' },
              { title: '工数を記録して収支を見る', body: 'タイムシートの時間から、人件費と利益率を出します。' },
            ]}
          />
          <Card>
            <EmptyState
              title="まだプロジェクトはありません"
              description="最初のプロジェクトをつくると、ここに進み具合と収支が並びます。"
              art={PROMANE_UI_NEXT_ART.empty}
              action={<Button href={newHref} icon="Plus">最初のプロジェクトをつくる</Button>}
            />
          </Card>
        </>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatTile label="売上合計" value={formatCurrency(data.totalRevenue)} icon="BadgeJapaneseYen" />
          <StatTile label="原価合計" value={formatCurrency(data.totalCost)} icon="Wallet" />
          <StatTile label="利益率" value={formatPercent(data.totalProfitRate)} sub={<span className={PROFIT_TEXT[tone]}>{profitLabel(data.totalProfit)}</span>} icon="LineChart" />
          <StatTile label="進行中の案件" value={data.activeProjects} unit="件" icon="FolderKanban" href={`${base}/projects`} />
        </div>
      )}

      {myMember && (
        <Card
          title={<>あなたの担当<span className="ml-2 align-middle"><Badge tone="blue">{ROLE_LABELS[myMember.role] || myMember.role}</Badge></span></>}
          meta={<>未完了のタスク <strong className="tabular-nums text-slate-900">{myData.tasks.length}</strong> 件</>}
        >
          {myData.tasks.length === 0 ? (
            <p className="text-sm text-slate-600">
              タスクはまだ割り振られていません。プロジェクトの画面でタスクをつくり、担当を決めましょう。
            </p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div className="min-w-0">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-slate-500"><ListChecks size={14} aria-hidden />直近のタスク</p>
                <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                  {myData.tasks.slice(0, 5).map((t) => {
                    const st = TASK_STATUS[t.status]
                    return (
                      <li key={t.id}>
                        <Link href={`${base}/projects/${t.project.id}`} className="flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-slate-50">
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-slate-900">{t.title}</span>
                            <span className="block truncate text-xs text-slate-500">{t.project.name}</span>
                          </span>
                          <Badge tone={st?.tone ?? 'neutral'}>{st?.label ?? t.status}</Badge>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
              {myData.myProjects.length > 0 && (
                <div className="min-w-0">
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-slate-500"><FolderOpen size={14} aria-hidden />参加中の案件</p>
                  <div className="flex flex-wrap gap-2">
                    {myData.myProjects.slice(0, 8).map((p) => (
                      <Link key={p.id} href={`${base}/projects/${p.id}`} className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-700">
                        <span className="truncate">{p.name}</span>
                        <span className="tabular-nums text-slate-400">{p.taskCount}</span>
                      </Link>
                    ))}
                    {myData.myProjects.length > 8 && <span className="px-2 py-1.5 text-xs text-slate-500">ほか{myData.myProjects.length - 8}件</span>}
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {!empty && (
        <>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card title="タスクの進み具合" meta="すべての案件"><TaskPieChart data={chartData.taskSummary} /></Card>
            <Card title="売上と利益" meta="直近6か月"><RevenueLineChart data={chartData.revenueData} /></Card>
            <Card title="月ごとの利益" meta="直近6か月"><ProfitBarChart data={chartData.revenueData} /></Card>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="min-w-0 lg:col-span-2">
              <Card
                title="案件一覧"
                meta={<Link href={`${base}/projects`} className="inline-flex items-center gap-1 font-semibold text-blue-700 hover:underline">すべて見る<ArrowRight size={14} aria-hidden /></Link>}
              >
                {/* ⚠️ 目立たせるのは案件名と収支。顧客が未設定なら薄い「—」（S-50） */}
                <ul className="-mx-2 divide-y divide-slate-100">
                  {data.projectStats.map((p) => {
                    const pt = profitTone(p.profit)
                    return (
                      <li key={p.id}>
                        <Link href={`${base}/projects/${p.id}`} className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 rounded-lg px-2 py-3 hover:bg-slate-50">
                          <span className="min-w-0">
                            <span className="block truncate text-[15px] font-bold text-slate-900 group-hover:text-blue-700">{p.name}</span>
                            <span className="mt-0.5 flex min-w-0 items-center gap-2 text-xs">
                              <span className={`shrink-0 rounded-full px-2 py-0.5 font-semibold ${PROJECT_STATUS_COLORS[p.status] ?? 'bg-slate-100 text-slate-700'}`}>{PROJECT_STATUS_LABELS[p.status] ?? p.status}</span>
                              <span className={`truncate ${p.client?.name ? 'text-slate-500' : 'text-slate-300'}`}>{p.client?.name || '—'}</span>
                            </span>
                          </span>
                          <span className="text-right">
                            <span className="block whitespace-nowrap text-[15px] font-bold tabular-nums text-slate-900">{formatCurrency(p.revenue)}</span>
                            <span className={`block whitespace-nowrap text-xs font-semibold tabular-nums ${p.revenue > 0 ? PROFIT_TEXT[pt] : 'text-slate-300'}`}>
                              {p.revenue > 0 ? `利益率 ${formatPercent(p.profitRate)}` : '—'}
                            </span>
                          </span>
                          <span className="col-span-2 flex items-center gap-3">
                            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                              <span className="block h-full rounded-full bg-[#0066ff]" style={{ width: `${Math.max(0, Math.min(100, Math.round(p.progress)))}%` }} />
                            </span>
                            <span className="w-16 shrink-0 text-right text-xs tabular-nums text-slate-500">進み {Math.round(p.progress)}%</span>
                          </span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </Card>
            </div>
            <Card title="最近の動き" meta="チーム"><Activities items={chartData.activities} /></Card>
          </div>
        </>
      )}
    </div>
  )
}

/* 最近の動き。今までの ActivityTimeline は絵文字をアイコンにしているので、新しい見た目では lucide で描く */
function Activities({ items }: { items: { id: string; title: string; user: string; time: string; icon?: string }[] }) {
  if (items.length === 0) {
    return <p className="py-6 text-center text-sm text-slate-500">まだ動きはありません。タスクを動かすと、ここに並びます。</p>
  }
  return (
    <ul className="space-y-3">
      {items.map((item) => {
        // page.tsx の icon（完了・進行中・それ以外）を、同じ意味の lucide に置き換える
        const Icon = item.icon === '\u2705' ? CheckCircle2 : item.icon === '\u26a1' ? Loader : CircleDashed
        return (
          <li key={item.id} className="flex items-start gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-50 text-[#0066ff]"><Icon size={16} aria-hidden /></span>
            <span className="min-w-0">
              <span className="block text-sm leading-snug text-slate-900"><strong className="font-bold text-blue-700">{item.user}</strong> が {item.title}</span>
              <span className="mt-0.5 block text-xs text-slate-500">{item.time}</span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}
