'use client'

import { clsx } from 'clsx'
import { Badge } from './Badge'

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  description?: string
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={clsx(
        'w-full text-left p-4 rounded-2xl border bg-white transition-all duration-200 active:scale-[0.99] motion-reduce:transform-none motion-reduce:transition-none',
        checked
          ? 'border-green-200 hover:border-green-300 bg-green-50/40'
          : 'border-gray-200 hover:border-gray-300'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold text-gray-900">{label}</p>
          {description ? <p className="text-sm text-gray-600 mt-1">{description}</p> : null}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Badge tone={checked ? 'green' : 'gray'}>{checked ? 'ON' : 'OFF'}</Badge>
          <span className="relative inline-flex h-7 w-12 items-center">
            <span
              className={clsx(
                'absolute inset-0 rounded-full transition-colors',
                checked ? 'bg-green-600' : 'bg-gray-300'
              )}
            />
            <span
              className={clsx(
                'relative h-6 w-6 rounded-full bg-white shadow-sm ring-1 ring-black/10 transition-transform',
                checked ? 'translate-x-6' : 'translate-x-1'
              )}
            />
          </span>
        </div>
      </div>
    </button>
  )
}


