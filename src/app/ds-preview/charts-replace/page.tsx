'use client'
// 開発用プレビュー: 各ツールの古いグラフを ds/charts に置き換えた形を、見本のデータで並べる。
// ログインの要る画面（AIO・バナーの統計・インタビューの採点・展示会の予算）と同じ組み立て方にしてある。
// ⚠️ 本番では 404（ds-preview の layout）。
import { AreaChart, Bars, ColumnChart, DivergingBars, Donut, MiniStack, Ring, StackedBar100 } from '@/components/ds/charts'
import { TaskPieChart, RevenueLineChart, ProfitBarChart } from '@/components/promane/dashboard-charts'
import { ReportChart } from '@/components/promane/report-chart'
import CashBars from '@/components/expense/CashBars'

function Box({ title, children, wide }: { title: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <section className={`bg-white rounded-2xl border border-slate-200 p-5 ${wide ? 'md:col-span-2' : ''}`}>
      <h3 className="text-sm font-black text-slate-700 mb-3">{title}</h3>
      {children}
    </section>
  )
}

const TREND = [
  { date: '9/1', 認知度: 12, SoV: 8 },
  { date: '9/8', 認知度: 18, SoV: 11 },
  { date: '9/15', 認知度: 16, SoV: 14 },
  { date: '9/22', 認知度: 27, SoV: 19 },
  { date: '9/29', 認知度: 33, SoV: 22 },
  { date: '10/6', 認知度: 41, SoV: 25 },
]

const yen = (n: number) => `¥${Math.round(n).toLocaleString()}`
const BUDGET = [
  { label: '小間料', value: 1650000 },
  { label: '装飾・施工', value: 1200000 },
  { label: '制作物', value: 380000 },
  { label: 'ノベルティ', value: 240000 },
  { label: '人件費', value: 420000 },
  { label: '電気', value: 90000 },
]
const BUDGET_TOTAL = BUDGET.reduce((a, b) => a + b.value, 0)

// 2段目の見本（本物の部品を、新しい見た目の値を渡して描く）
const PM_REVENUE = [
  { month: '5月', revenue: 1800000, cost: 1500000, profit: 300000 },
  { month: '6月', revenue: 2400000, cost: 1700000, profit: 700000 },
  { month: '7月', revenue: 900000, cost: 1300000, profit: -400000 },
  { month: '8月', revenue: 3100000, cost: 2000000, profit: 1100000 },
  { month: '9月', revenue: 2600000, cost: 2300000, profit: 300000 },
  { month: '10月', revenue: 3500000, cost: 2100000, profit: 1400000 },
]
const CASH_MONTHS = ['2026-11', '2026-12', '2027-01', '2027-02', '2027-03', '2027-04', '2027-05', '2027-06', '2027-07', '2027-08', '2027-09', '2027-10']
const CASH = (() => {
  const base: Record<string, [number, number]> = { saas: [120000, 0], contractor: [450000, 150000], rent: [220000, 0], ads: [180000, 80000], payroll: [900000, 0] }
  const cells: Record<string, Record<string, { amount: number; estimated: number }>> = {}
  const totals: Record<string, { amount: number; estimated: number }> = {}
  CASH_MONTHS.forEach((m, i) => {
    let a = 0, e = 0
    for (const [c, [amt, est]] of Object.entries(base)) {
      const future = i >= 2
      const amount = Math.round(amt * (1 + (i % 3) * 0.08))
      const estimated = future ? Math.round(amount * 0.5) + est : 0
      ;(cells[c] ??= {})[m] = { amount, estimated: Math.min(amount, estimated) }
      a += amount; e += Math.min(amount, estimated)
    }
    totals[m] = { amount: a, estimated: e }
  })
  return { months: CASH_MONTHS, categories: Object.keys(base), cells, totals }
})()

function Stage2() {
  return (
    <>
      <Box title="プロマネ タスクの割合（recharts → Donut・中央に完了率）">
        <TaskPieChart data={[{ status: 'done', count: 18 }, { status: 'in_progress', count: 9 }, { status: 'review', count: 4 }, { status: 'todo', count: 11 }]} />
      </Box>
      <Box title="プロマネ 売上と利益（recharts → AreaChart・負の値）">
        <RevenueLineChart data={PM_REVENUE} />
      </Box>
      <Box title="プロマネ 月ごとの利益（recharts → ColumnChart・赤字は下へ）">
        <ProfitBarChart data={PM_REVENUE} />
      </Box>
      <Box title="プロマネ 案件ごとの利益率（→ DivergingBars）">
        <DivergingBars label="案件ごとの利益率" negativeLabel="赤字" positiveLabel="黒字" positiveTone="good" negativeTone="negative" format={(n) => `${n}%`}
          data={[{ label: 'コーポレートサイト改修', value: 34 }, { label: 'LP 制作（春）', value: 18 }, { label: '採用動画', value: 2 }, { label: 'EC 移行', value: -12 }, { label: '保守', value: -27 }]} />
      </Box>
      <div className="md:col-span-2">
        <ReportChart data={[
          { name: 'サイト改修', revenue: 3200000, cost: 2100000, profit: 1100000 },
          { name: 'LP 制作', revenue: 1200000, cost: 980000, profit: 220000 },
          { name: '採用動画', revenue: 800000, cost: 790000, profit: 10000 },
          { name: 'EC 移行', revenue: 2500000, cost: 2800000, profit: -300000 },
        ]} />
      </div>
      <Box title="支出 12か月の出金（div → StackedColumnChart・見込みは薄い色）" wide>
        <CashBars cash={CASH} />
      </Box>
      <Box title="ポップアップ 日別の表示とクリック（重ねた縦棒 → AreaChart 2系列）">
        <AreaChart label="日別の表示とクリック" yTicks height={180}
          labels={Array.from({ length: 30 }, (_, i) => `10/${i + 1}`)}
          series={[
            { name: '表示', values: Array.from({ length: 30 }, (_, i) => 200 + Math.round(80 * Math.sin(i / 3)) + i * 4) },
            { name: 'クリック', values: Array.from({ length: 30 }, (_, i) => 12 + Math.round(6 * Math.cos(i / 4))), tone: 'pink' },
          ]} />
      </Box>
      <Box title="バナー 直近7日の生成数（div → ColumnChart）">
        <ColumnChart label="直近7日の生成数" height={160} yTicks={false} format={(n) => `${n}件`}
          data={['10/16', '10/17', '10/18', '10/19', '10/20', '10/21', '10/22'].map((d, i) => ({ label: d, value: [4, 0, 12, 7, 3, 15, 9][i] }))} />
      </Box>
      <Box title="AIO SoV 上位10（recharts → Bars・自社を強調）">
        <Bars format={(n) => `${n}%`} data={[
          { label: '競合A', value: 28 }, { label: '自社', value: 22, highlight: '自社' }, { label: '競合B', value: 17 }, { label: '競合C', value: 12 }, { label: '競合D', value: 8 },
        ]} />
      </Box>
      <Box title="勤怠 通常・残業（div → MiniStack）">
        <div className="flex flex-col gap-2 text-sm">
          {[[480, 0], [570, 90], [660, 180]].map(([w, o]) => (
            <div key={w} className="flex items-center gap-3"><span className="w-20 tabular-nums">{w}分</span>
              <MiniStack basis={480} label={`勤務 ${w}分（うち残業 ${o}分）`} parts={[{ value: w - o, tone: 'blue' }, { value: o, tone: 'fair' }]} />
              <span className="tabular-nums text-orange-600">{o ? `残業 ${o}分` : ''}</span></div>
          ))}
        </div>
      </Box>
      <Box title="展示会 予算のドーナツ（SVG → Donut・中央に見積合計・費目の色）">
        <div className="flex justify-center">
          <Donut label="予算の内訳" size={180}
            center={<span><span style={{ fontSize: 11, color: 'var(--sub)' }}>見積合計</span><br /><span style={{ fontSize: 18 }}>398万円</span></span>}
            colors={['#7f19e6', '#4c0f8f', '#f59e0b', '#10b981', '#ec4899', '#3b82f6']}
            data={BUDGET} />
        </div>
      </Box>
      <Box title="展示会 概要の内訳（div → StackedBar100・残りは灰色）">
        <StackedBar100 label="予算の内訳" showTotal={false}
          categories={[...BUDGET.map((b, i) => ({ name: `${b.label} ${Math.round(b.value / 10000)}万円`, tone: ['#7f19e6', '#4c0f8f', '#10b981', '#ec4899', '#3b82f6', '#f59e0b'][i] })), { name: '残り 102万円', tone: 'muted' }]}
          rows={[{ label: '見積 398万円／予算 500万円', values: [...BUDGET.map((b) => b.value), 1020000] }]} />
      </Box>
    </>
  )
}

export default function Page() {
  return (
    <div style={{ padding: 16 }} className="grid md:grid-cols-2 gap-4">
      <Box title="AIO ブランド認知度（Gauge → Ring）">
        <div className="text-center">
          <div className="inline-grid place-items-center">
            <Ring value={0.41} size={160} label="AIの回答に登場した割合 41%">
              <div className="text-center">
                <p className="text-3xl font-black text-slate-900 tabular-nums">41%</p>
                <div className="mt-1 flex justify-center"><span className="text-[11px] font-black px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">+8pt 前回比</span></div>
              </div>
            </Ring>
          </div>
          <p className="text-sm font-bold text-slate-500 mt-1">AIの回答に登場した割合</p>
        </div>
      </Box>

      <Box title="AIO 認知度・SoVの推移（recharts → AreaChart）">
        <div style={{ minHeight: 220 }}>
          <AreaChart
            labels={TREND.map((t) => t.date)}
            series={[
              { name: '認知度', values: TREND.map((t) => t['認知度']) },
              { name: 'SoV', values: TREND.map((t) => t.SoV), tone: 'cyan' },
            ]}
            height={200}
            format={(n) => `${n}%`}
          />
        </div>
      </Box>

      <Box title="AIO センチメント分析（横棒 → Donut）" wide>
        <div className="flex justify-center py-1">
          <Donut
            label="センチメント ポジティブ62% ニュートラル29% ネガティブ9%"
            data={[
              { label: 'ポジティブ', value: 62 },
              { label: 'ニュートラル', value: 29 },
              { label: 'ネガティブ', value: 9 },
            ]}
          />
        </div>
      </Box>

      <Box title="バナー 業種別ランキング（div → Bars）">
        <Bars
          data={[
            ['IT・SaaS', 48], ['EC・通販', 31], ['不動産', 22], ['美容・健康', 17], ['教育', 9],
          ].map(([l, v], i) => ({ label: `${i + 1}位 ${l}`, value: v as number }))}
          format={(n) => `${n.toLocaleString('ja-JP')}件`}
        />
      </Box>

      <Box title="インタビュー 採点（ScoreGauge → Ring）">
        <div className="relative flex flex-col items-center">
          <Ring value={0.84} size={160} label="採点 84点（100点満点）素晴らしい！">
            <div className="flex flex-col items-center leading-none">
              <span className="text-5xl font-black text-slate-900 tabular-nums">84</span>
              <span className="text-sm text-slate-500 font-medium mt-1">点</span>
            </div>
          </Ring>
          <p className="text-sm font-bold mt-3 text-slate-700">素晴らしい！</p>
        </div>
      </Box>

      <Box title="展示会 費目ごとの金額（表の細い棒 → Bars）" wide>
        <Bars
          data={BUDGET.map((b) => ({ ...b, sub: `${Math.round((b.value / BUDGET_TOTAL) * 100)}%` }))}
          format={yen}
        />
      </Box>
      <Stage2 />
    </div>
  )
}
