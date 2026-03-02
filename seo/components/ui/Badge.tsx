import { type HTMLAttributes } from 'react'
import { clsx } from 'clsx'

type Tone = 'gray' | 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'cyan' | 'pink' | 'orange'

export function Badge({
  tone = 'gray',
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  const map: Record<Tone, string> = {
    gray: 'bg-gray-100 text-gray-700 border border-gray-200',
    blue: 'bg-blue-50 text-blue-700 border border-blue-200',
    green: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    amber: 'bg-amber-50 text-amber-700 border border-amber-200',
    red: 'bg-red-50 text-red-700 border border-red-200',
    purple: 'bg-purple-50 text-purple-700 border border-purple-200',
    cyan: 'bg-cyan-50 text-cyan-700 border border-cyan-200',
    pink: 'bg-pink-50 text-pink-700 border border-pink-200',
    orange: 'bg-orange-50 text-orange-700 border border-orange-200',
  }
  return (
    <span
      {...props}
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold',
        map[tone],
        className
      )}
    />
  )
}