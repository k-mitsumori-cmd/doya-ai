'use client'

import {
  PieChart, Pie, Cell, ResponsiveContainer,
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts'
import { AreaChart, ColumnChart, Donut } from '@/components/ds/charts'
import { formatCompactJa } from '@/components/ds/chart-math'
import { useUiNext } from '@/components/shell/ui-next-context'

const yen = (n: number) => `${n < 0 ? '−' : ''}¥${Math.abs(Math.round(n)).toLocaleString('ja-JP')}`
/** 意味のある色（完了=良い、レビュー=普通、未着手=灰色） */
const STATUS_TONES: Record<string, string> = {
  done: 'good',
  in_progress: 'blue',
  review: 'fair',
  todo: 'muted',
}

const STATUS_COLORS: Record<string, string> = {
  done: '#10b981',
  in_progress: '#3b82f6',
  review: '#f59e0b',
  todo: '#94a3b8',
}

const STATUS_LABELS: Record<string, string> = {
  done: '完了',
  in_progress: '進行中',
  review: 'レビュー',
  todo: '未着手',
}

interface TaskSummaryProps {
  data: { status: string; count: number }[]
}

export function TaskPieChart({ data }: TaskSummaryProps) {
  const next = useUiNext()
  const total = data.reduce((s, d) => s + (d.count || 0), 0)
  const doneCount = data.find((d) => d.status === 'done')?.count || 0
  const completionRate = total > 0 ? Math.round((doneCount / total) * 100) : 0
  const chartData = data
    .filter((d) => (d.count || 0) > 0)
    .map((d) => ({
      name: STATUS_LABELS[d.status] || d.status,
      value: d.count,
      fill: STATUS_COLORS[d.status] || '#94a3b8',
    }))

  if (next) {
    // 新しい見た目: 共通の Donut。中央に完了率、凡例に件数と割合
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <Donut
          label={`タスクの状態（完了率 ${completionRate}%）`}
          size={140}
          empty="タスクがまだありません"
          center={<span><span style={{ fontSize: 22 }}>{completionRate}%</span><br /><span style={{ fontSize: 11, color: 'var(--sub)' }}>完了率</span></span>}
          data={data
            .filter((d) => (d.count || 0) > 0)
            .map((d) => ({ label: `${STATUS_LABELS[d.status] || d.status} ${d.count}件`, value: d.count, tone: STATUS_TONES[d.status] || 'muted' }))}
        />
      </div>
    )
  }

  // 空データ時はプレースホルダー
  if (chartData.length === 0) {
    return (
      <div className="relative h-[200px] min-w-[100px] flex flex-col items-center justify-center">
        <div className="w-[110px] h-[110px] rounded-full border-[18px] border-gray-100" />
        <p className="text-[11px] font-black text-gray-400 mt-3">タスクがまだありません</p>
      </div>
    )
  }

  return (
    <div className="relative h-[200px] min-w-[100px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={chartData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={2} dataKey="value">
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip formatter={(value: any, name: any) => [`${value}件`, name]} />
        </PieChart>
      </ResponsiveContainer>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <p className="text-[28px] font-black text-gray-900 leading-none">{completionRate}<span className="text-base">%</span></p>
        <p className="text-[10px] font-black text-gray-400 mt-1">完了率</p>
      </div>
    </div>
  )
}

interface RevenueData {
  month: string
  revenue: number
  cost: number
  profit: number
}

export function RevenueLineChart({ data }: { data: RevenueData[] }) {
  const next = useUiNext()
  if (next && data && data.length > 0) {
    // 新しい見た目: 共通の AreaChart。利益の負の値は 0 の線の下に出る
    return (
      <AreaChart
        label="売上と利益の推移"
        labels={data.map((d) => d.month)}
        yTicks
        format={yen}
        series={[
          { name: '売上', values: data.map((d) => d.revenue) },
          { name: '利益', values: data.map((d) => d.profit), tone: 'good' },
        ]}
      />
    )
  }
  if (!data || data.length === 0) {
    return (
      <div className="h-[200px] min-w-[200px] flex items-center justify-center">
        <p className="text-[11px] font-black text-gray-400">データがまだありません</p>
      </div>
    )
  }
  return (
    <div className="h-[200px] min-w-[200px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
          <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(v) => `${(v / 10000).toFixed(0)}万`} />
          <Tooltip
            formatter={(value: any) => `¥${Number(value).toLocaleString()}`}
            labelStyle={{ fontWeight: 900, color: '#0f172a' }}
            contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
          />
          <Legend wrapperStyle={{ fontSize: 11, fontWeight: 700 }} />
          <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} name="売上" />
          <Line type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} name="利益" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function ProfitBarChart({ data }: { data: RevenueData[] }) {
  const next = useUiNext()
  if (next && data && data.length > 0) {
    // 新しい見た目: 共通の ColumnChart。赤字の月は下へ伸び、色と「−」の記号で分かる
    return (
      <ColumnChart
        label="月ごとの利益"
        // 棒の上の値は短い形（狭いカードでも重ならないように）
        format={(n) => `${formatCompactJa(n)}円`}
        data={data.map((d) => ({ label: d.month, value: d.profit, tone: d.profit < 0 ? 'negative' : 'blue' }))}
      />
    )
  }
  if (!data || data.length === 0) {
    return (
      <div className="h-[200px] min-w-[200px] flex items-center justify-center">
        <p className="text-[11px] font-black text-gray-400">データがまだありません</p>
      </div>
    )
  }
  return (
    <div className="h-[200px] min-w-[200px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
          <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(v) => `${(v / 10000).toFixed(0)}万`} />
          <Tooltip
            formatter={(value: any) => `¥${Number(value).toLocaleString()}`}
            labelStyle={{ fontWeight: 900, color: '#0f172a' }}
            contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0' }}
          />
          <Bar dataKey="profit" fill="url(#profitGradient)" radius={[8, 8, 0, 0]} name="利益" />
          <defs>
            <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3d80ff" />
              <stop offset="100%" stopColor="#3b82f6" />
            </linearGradient>
          </defs>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

interface ActivityItem {
  id: string
  type: 'task' | 'project' | 'member'
  title: string
  user: string
  time: string
  icon?: string
}

export function ActivityTimeline({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-[13px] text-gray-400 font-bold">まだアクティビティがありません</p>
      </div>
    )
  }
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id} className="flex items-start gap-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-100 to-brand-50 flex items-center justify-center text-base">
            {item.icon || '✨'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-gray-900 leading-tight">
              <span className="font-black text-blue-700">{item.user}</span> が {item.title}
            </p>
            <p className="text-[11px] text-gray-400 mt-0.5 font-bold">{item.time}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
