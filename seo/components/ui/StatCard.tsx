import { type ReactNode } from 'react'
import { clsx } from 'clsx'

export function StatCard({
  label,
  value,
  sub,
  icon,
  tone = 'gray',
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  icon?: ReactNode
  tone?: 'gray' | 'blue' | 'green' | 'amber' | 'red' | 'purple'
}) {
  const toneMap: Record<string, { bg: string; border: string; icon: string; value: string }> = {
    gray: { bg: 'bg-gray-50', border: 'border-gray-200', icon: 'text-gray-400', value: 'text-gray-900' },
    blue: { bg: 'bg-blue-50', border: 'border-blue-200', icon: 'text-blue-500', value: 'text-blue-700' },
    green: { bg: 'bg-emerald-50', border: 'border-emerald-200', icon: 'text-emerald-500', value: 'text-emerald-700' },
    amber: { bg: 'bg-amber-50', border: 'border-amber-200', icon: 'text-amber-500', value: 'text-amber-700' },
    red: { bg: 'bg-red-50', border: 'border-red-200', icon: 'text-red-500', value: 'text-red-700' },
    purple: { bg: 'bg-purple-50', border: 'border-purple-200', icon: 'text-purple-500', value: 'text-purple-700' },
  }
  const t = toneMap[tone] || toneMap.gray
  return (
    <div className={clsx('rounded-2xl border p-4', t.bg, t.border)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{label}</p>
          <p className={clsx('mt-2 text-2xl font-extrabold', t.value)}>{value}</p>
          {sub ? <p className="mt-1 text-sm text-gray-500">{sub}</p> : null}
        </div>
        {icon ? <div className={t.icon}>{icon}</div> : null}
      </div>
    </div>
  )
}


export function StatCard({
  label,
  value,
  sub,
  icon,
  tone = 'gray',
}: {
  label: string
  value: ReactNode
  sub?: ReactNode
  icon?: ReactNode
  tone?: 'gray' | 'blue' | 'green' | 'amber' | 'red' | 'purple'
}) {
  const toneMap: Record<string, { bg: string; border: string; icon: string; value: string }> = {
    gray: { bg: 'bg-gray-50', border: 'border-gray-200', icon: 'text-gray-400', value: 'text-gray-900' },
    blue: { bg: 'bg-blue-50', border: 'border-blue-200', icon: 'text-blue-500', value: 'text-blue-700' },
    green: { bg: 'bg-emerald-50', border: 'border-emerald-200', icon: 'text-emerald-500', value: 'text-emerald-700' },
    amber: { bg: 'bg-amber-50', border: 'border-amber-200', icon: 'text-amber-500', value: 'text-amber-700' },
    red: { bg: 'bg-red-50', border: 'border-red-200', icon: 'text-red-500', value: 'text-red-700' },
    purple: { bg: 'bg-purple-50', border: 'border-purple-200', icon: 'text-purple-500', value: 'text-purple-700' },
  }
  const t = toneMap[tone] || toneMap.gray
  return (
    <div className={clsx('rounded-2xl border p-4', t.bg, t.border)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{label}</p>
          <p className={clsx('mt-2 text-2xl font-extrabold', t.value)}>{value}</p>
          {sub ? <p className="mt-1 text-sm text-gray-500">{sub}</p> : null}
        </div>
        {icon ? <div className={t.icon}>{icon}</div> : null}
      </div>
    </div>
  )
}