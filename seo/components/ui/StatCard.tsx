import { type ReactNode } from 'react'
import { Card, CardBody } from './Card'
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
  const toneMap: Record<string, string> = {
    gray: 'from-gray-50 to-white',
    blue: 'from-blue-50 to-white',
    green: 'from-green-50 to-white',
    amber: 'from-amber-50 to-white',
    red: 'from-red-50 to-white',
    purple: 'from-purple-50 to-white',
  }
  return (
    <Card className={clsx('bg-gradient-to-br', toneMap[tone])}>
      <CardBody>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{label}</p>
            <p className="mt-2 text-2xl font-extrabold text-gray-900">{value}</p>
            {sub ? <p className="mt-1 text-sm text-gray-600">{sub}</p> : null}
          </div>
          {icon ? <div className="text-gray-400">{icon}</div> : null}
        </div>
      </CardBody>
    </Card>
  )
}


