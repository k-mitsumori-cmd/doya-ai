'use client'

import { clsx } from 'clsx'

export type TabItem<T extends string> = {
  id: T
  label: string
  badge?: string
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: TabItem<T>[]
  value: T
  onChange: (v: T) => void
  className?: string
}) {
  return (
    <div className={clsx('flex flex-wrap gap-2', className)}>
      {tabs.map((t) => {
        const active = t.id === value
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={clsx(
              'px-3 py-2 rounded-xl text-sm font-bold border transition-colors inline-flex items-center gap-2',
              active ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-200 text-gray-700 hover:bg-gray-50'
            )}
          >
            <span>{t.label}</span>
            {t.badge ? (
              <span className={clsx('text-[10px] px-2 py-0.5 rounded-full', active ? 'bg-white/15' : 'bg-gray-100')}>
                {t.badge}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}




