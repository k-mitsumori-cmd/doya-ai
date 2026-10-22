'use client'
// 開発用プレビュー: 各ツールの古いグラフを ds/charts に置き換えた形を、見本のデータで並べる。
// ログインの要る画面（AIO・バナーの統計・インタビューの採点・展示会の予算）と同じ組み立て方にしてある。
// ⚠️ 本番では 404（ds-preview の layout）。
import { AreaChart, Bars, Donut, Ring } from '@/components/ds/charts'

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
    </div>
  )
}
