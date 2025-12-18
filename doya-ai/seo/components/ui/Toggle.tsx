'use client'

import { clsx } from 'clsx'

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
      className="w-full text-left p-4 rounded-2xl border border-gray-200 hover:border-gray-300 transition-colors bg-white"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold text-gray-900">{label}</p>
          {description ? <p className="text-sm text-gray-600 mt-1">{description}</p> : null}
        </div>
        <span
          className={clsx(
            'relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border transition-colors',
            checked ? 'bg-gray-900 border-gray-900' : 'bg-gray-200 border-gray-200'
          )}
        >
          <span
            className={clsx(
              'inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform',
              checked ? 'translate-x-5' : 'translate-x-1'
            )}
          />
        </span>
      </div>
    </button>
  )
}


