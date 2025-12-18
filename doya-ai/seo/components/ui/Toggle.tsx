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
        'w-full text-left p-4 rounded-2xl border transition-colors bg-white',
        checked ? 'border-green-200 hover:border-green-300' : 'border-gray-200 hover:border-gray-300'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold text-gray-900">{label}</p>
          {description ? <p className="text-sm text-gray-600 mt-1">{description}</p> : null}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Badge tone={checked ? 'green' : 'gray'}>{checked ? 'ON' : 'OFF'}</Badge>
          <span
            className={clsx(
              'relative inline-flex h-8 w-14 rounded-full border transition-colors',
              checked ? 'bg-green-600 border-green-600' : 'bg-gray-200 border-gray-200'
            )}
          >
            <span
              className={clsx(
                'absolute inset-0 flex items-center justify-center text-[10px] font-extrabold tracking-wide',
                checked ? 'text-white/90 pr-5' : 'text-gray-600 pl-5'
              )}
            >
              {checked ? 'ON' : 'OFF'}
            </span>
            <span
              className={clsx(
                'inline-block h-7 w-7 transform rounded-full bg-white shadow-sm transition-transform',
                checked ? 'translate-x-6' : 'translate-x-1'
              )}
            />
          </span>
        </div>
      </div>
    </button>
  )
}


