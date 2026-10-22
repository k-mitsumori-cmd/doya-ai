'use client'
// ds/charts と数え上げの見本。数字はすべて見本の値（取得しない）
import { useState } from 'react'
import { Button, Card, StatTile } from '@/components/ds'
import { CountUp } from '@/components/ds/motion'
import {
  AreaChart, Bars, ColumnChart, DivergingBars, Donut, GroupedColumnChart, RadarChart, Ring, Sparkline, StackedBar100, StackedColumnChart,
} from '@/components/ds/charts'

const MONTHS = ['5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月', '1月', '2月', '3月', '4月']
const man = (n: number) => `${Math.round(n / 10000).toLocaleString('ja-JP')}万円`
const RING_TH = [
  { at: 0, tone: 'poor', label: '要改善' },
  { at: 0.5, tone: 'fair', label: '普通' },
  { at: 0.8, tone: 'good', label: '良い' },
]

const grid = (min: number) => ({ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${min}px), 1fr))`, gap: 16 }) as const

export default function ChartsPreview() {
  // 「もう一度」で部品を作り直し、動きを見直す
  const [round, setRound] = useState(0)
  return (
    <div key={round} style={{ padding: 24, display: 'grid', gap: 16, minWidth: 0 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Button size="sm" variant="secondary" icon="RotateCcw" onClick={() => setRound((r) => r + 1)}>動きをもう一度見る</Button>
        <span style={{ fontSize: 13, color: 'var(--sub)' }}>動きを減らす設定では、最初から最後の形で出ます。</span>
      </div>

      <section style={grid(200)} aria-label="数え上げ">
        <StatTile icon="BarChart3" label="今月の受注" value={2650000} unit="円" sub="4件" countUp />
        <StatTile icon="Users" label="新しい登録" value={1284} unit="人" sub="先月より +12%" countUp />
        <StatTile icon="Target" label="平均スコア" value={87.5} unit="点" sub="100点満点" countUp />
        <StatTile icon="Wallet" label="数え上げない" value={782} unit="万円" sub="countUp={false}" countUp={false} />
      </section>

      <Card title="数え上げ（CountUp）" meta="桁が増えても幅が変わらない">
        <p style={{ margin: 0, fontSize: 28, fontWeight: 800 }}>
          <CountUp value={12345678} format={(n) => `${Math.round(n).toLocaleString('ja-JP')}円`} />
        </p>
      </Card>

      <div style={grid(320)}>
        <Card title="面グラフ（3系列・縦軸の目盛り）">
          <AreaChart
            labels={MONTHS}
            yTicks
            format={man}
            series={[
              { name: '売上', values: [320, 410, 380, 520, 610, 580, 720, 690, 810, 760, 880, 940].map((v) => v * 10000) },
              { name: '目標', values: [400, 400, 450, 450, 500, 500, 600, 600, 700, 700, 800, 800].map((v) => v * 10000) },
              { name: '前年', values: [280, 300, 330, 350, 420, 400, 450, 470, 520, 540, 600, 620].map((v) => v * 10000) },
            ]}
          />
        </Card>
        <Card title="面グラフ（負の値・範囲の指定なし）">
          <AreaChart
            labels={MONTHS}
            yTicks
            format={man}
            series={[{ name: '営業利益', values: [-120, -80, -20, 40, 90, 60, -30, 110, 160, 140, 210, 260].map((v) => v * 10000) }]}
          />
        </Card>
        <Card title="面グラフ（範囲を 0〜100 に固定）">
          <AreaChart
            labels={['1週', '2週', '3週', '4週', '5週', '6週']}
            yTicks={5}
            domain={[0, 100]}
            tickFormat={(n) => `${n}`}
            format={(n) => `${n}点`}
            series={[{ name: 'AIO スコア', values: [42, 48, 55, 61, 66, 72] }, { name: '競合の平均', values: [50, 51, 53, 52, 54, 55] }]}
          />
        </Card>
        <Card title="小さな折れ線（Sparkline）">
          <Sparkline data={[3, 5, 4, 8, 7, 9, 12, 11, 14]} label="直近9日の生成数" />
        </Card>
      </div>

      <div style={grid(320)}>
        <Card title="縦棒（ColumnChart・自社だけ強調）">
          <ColumnChart
            label="サイト別の AI 引用数"
            data={[
              { label: 'A社', value: 42 },
              { label: '自社', value: 68, highlight: true },
              { label: 'B社', value: 35 },
              { label: 'C社', value: 51 },
              { label: 'D社', value: 22 },
            ]}
          />
        </Card>
        <Card title="縦棒（12本・負の値）">
          <ColumnChart
            label="月ごとの増減"
            format={(n) => `${n}件`}
            data={MONTHS.map((m, i) => ({ label: m, value: [12, -4, 8, 15, -9, 6, 21, 18, -2, 9, 14, 25][i] }))}
          />
        </Card>
        <Card title="複数系列の棒（GroupedColumnChart）">
          <GroupedColumnChart
            label="四半期ごとの商談数"
            labels={['1Q', '2Q', '3Q', '4Q']}
            series={[
              { name: '新規', values: [32, 41, 38, 52] },
              { name: '既存', values: [24, 28, 35, 31] },
              { name: '紹介', values: [8, 12, 10, 16] },
            ]}
          />
        </Card>
        <Card title="縦の積み上げ（StackedColumnChart）">
          <StackedColumnChart
            label="月ごとの生成数（ツール別）"
            labels={MONTHS.slice(0, 6)}
            series={[
              { name: 'バナー', values: [120, 150, 140, 180, 210, 230] },
              { name: 'SEO 記事', values: [60, 70, 85, 90, 95, 120] },
              { name: 'LP', values: [20, 25, 30, 28, 40, 45] },
              { name: 'その他', values: [10, 12, 15, 18, 20, 22] },
            ]}
          />
        </Card>
      </div>

      <div style={grid(320)}>
        <Card title="100% の横の積み上げ（StackedBar100）">
          <StackedBar100
            label="チャネル別の流入の割合"
            format={(n) => `${n.toLocaleString('ja-JP')}件`}
            categories={[{ name: '自然検索' }, { name: '広告' }, { name: 'SNS' }, { name: '紹介' }, { name: '直接' }, { name: 'メール' }]}
            rows={[
              { label: '5月', values: [420, 180, 90, 40, 120, 30] },
              { label: '6月', values: [510, 160, 120, 55, 110, 45] },
              { label: '7月', values: [580, 140, 160, 60, 130, 20] },
              { label: '空の月', values: [0, 0, 0, 0, 0, 0] },
            ]}
          />
        </Card>
        <Card title="0 を挟んで左右に伸びる棒（DivergingBars）">
          <DivergingBars
            label="先月からの増減"
            negativeLabel="減少"
            positiveLabel="増加"
            format={(n) => `${n}件`}
            data={[
              { label: '問い合わせ', value: 24 },
              { label: '資料請求', value: -12 },
              { label: '商談化', value: 8, highlight: '今月の重点' },
              { label: '失注', value: -18 },
              { label: '受注', value: 5 },
            ]}
          />
        </Card>
        <Card title="横棒（Bars・合計を基準・自社だけ強調）">
          <Bars
            basis="total"
            format={(n) => `${n}件`}
            data={[
              { label: 'A社', value: 42 },
              { label: '自社', value: 68, highlight: '自社' },
              { label: 'B社', value: 35 },
              { label: 'C社', value: 21 },
            ]}
          />
        </Card>
        <Card title="横棒（Bars・一番大きい値を基準・1本ずつの色）">
          <Bars
            format={man}
            data={[
              { label: 'リード', value: 8200000, sub: '41件', tone: 'blue' },
              { label: '商談', value: 5400000, sub: '18件', tone: 'sky' },
              { label: '見積', value: 3100000, sub: '9件', tone: 'pink' },
              { label: '受注', value: 2650000, sub: '4件', tone: 'navy' },
            ]}
          />
        </Card>
      </div>

      <div style={grid(320)}>
        <Card title="レーダー（RadarChart）">
          <RadarChart
            label="面接の評価"
            axes={['論理性', '熱意', '協調性', '専門性', '伝える力', '主体性']}
            max={5}
            format={(n) => n.toFixed(1)}
            series={[
              { name: '候補者', values: [4.2, 3.8, 4.5, 3.1, 4.0, 3.6] },
              { name: '合格者の平均', values: [3.8, 3.9, 3.7, 3.8, 3.6, 3.9] },
            ]}
          />
        </Card>
        <Card title="Ring（値に応じた色）">
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Ring value={0.86} label="AIO スコア" thresholds={RING_TH}><span style={{ fontSize: 20 }}>86</span></Ring>
            <Ring value={0.62} label="回答の網羅" thresholds={RING_TH}><span style={{ fontSize: 20 }}>62</span></Ring>
            <Ring value={0.31} label="引用のされやすさ" thresholds={RING_TH}><span style={{ fontSize: 20 }}>31</span></Ring>
            <Ring value={0.5} label="進み具合"><span style={{ fontSize: 18 }}>50%</span></Ring>
          </div>
        </Card>
        <Card title="Donut（中央の文字・6色以上）">
          <Donut
            label="流入元の割合"
            size={140}
            center={<span>合計<br />1,240件</span>}
            data={[
              { label: '自然検索', value: 520 }, { label: '広告', value: 240 }, { label: 'SNS', value: 180 },
              { label: '紹介', value: 120 }, { label: '直接', value: 100 }, { label: 'メール', value: 50 }, { label: 'その他', value: 30 },
            ]}
          />
        </Card>
        <Card title="Donut（意味のある色・色の配列・空）">
          <div style={{ display: 'grid', gap: 20 }}>
            <Donut
              label="口コミの感情"
              center={<span>320件</span>}
              data={[{ label: 'ポジティブ', value: 180, tone: 'positive' }, { label: 'ニュートラル', value: 90, tone: 'neutral' }, { label: 'ネガティブ', value: 50, tone: 'negative' }]}
            />
            <Donut
              label="評価の分布"
              colors={['good', 'fair', 'poor']}
              data={[{ label: '良い', value: 12 }, { label: '普通', value: 7 }, { label: '要改善', value: 3 }]}
            />
            <Donut label="まだデータが無い区分" data={[{ label: 'A', value: 0 }, { label: 'B', value: 0 }]} />
          </div>
        </Card>
      </div>
    </div>
  )
}
