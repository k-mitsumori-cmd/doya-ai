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
  const toneMap: Record<string, { bg: string; border: string; icon: string }> = {
    gray: { bg: 'bg-gray-800/50', border: 'border-gray-700', icon: 'text-gray-400' },
    blue: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', icon: 'text-blue-400' },
    green: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', icon: 'text-emerald-400' },
    amber: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', icon: 'text-amber-400' },
    red: { bg: 'bg-red-500/10', border: 'border-red-500/30', icon: 'text-red-400' },
    purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/30', icon: 'text-purple-400' },
  }
  const t = toneMap[tone] || toneMap.gray
  return (
    <div className={clsx('rounded-2xl border p-4', t.bg, t.border)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{label}</p>
          <p className="mt-2 text-2xl font-extrabold text-white">{value}</p>
          {sub ? <p className="mt-1 text-sm text-gray-400">{sub}</p> : null}
        </div>
        {icon ? <div className={t.icon}>{icon}</div> : null}
      </div>
    </div>
  )
}
