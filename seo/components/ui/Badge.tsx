import { type HTMLAttributes } from 'react'
import { clsx } from 'clsx'

type Tone = 'gray' | 'blue' | 'green' | 'amber' | 'red' | 'purple'

export function Badge({
  tone = 'gray',
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  const map: Record<Tone, string> = {
    gray: 'bg-gray-100 text-gray-700',
    blue: 'bg-blue-50 text-blue-700 border border-blue-100',
    green: 'bg-green-50 text-green-700 border border-green-100',
    amber: 'bg-amber-50 text-amber-800 border border-amber-100',
    red: 'bg-red-50 text-red-700 border border-red-100',
    purple: 'bg-purple-50 text-purple-700 border border-purple-100',
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


