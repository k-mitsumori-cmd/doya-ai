'use client'

import {
  PieChart, Pie, Cell, ResponsiveContainer,
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts'

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
              <stop offset="0%" stopColor="#8b5cf6" />
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
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-blue-100 to-violet-100 flex items-center justify-center text-base">
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
