import { type HTMLAttributes } from 'react'
import { clsx } from 'clsx'

type Tone = 'gray' | 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'cyan' | 'pink' | 'orange'

export function Badge({
  tone = 'gray',
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  const map: Record<Tone, string> = {
    gray: 'bg-gray-700/50 text-gray-300 border border-gray-600',
    blue: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',
    green: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
    amber: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
    red: 'bg-red-500/20 text-red-300 border border-red-500/30',
    purple: 'bg-purple-500/20 text-purple-300 border border-purple-500/30',
    cyan: 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30',
    pink: 'bg-pink-500/20 text-pink-300 border border-pink-500/30',
    orange: 'bg-orange-500/20 text-orange-300 border border-orange-500/30',
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
