import { clsx } from 'clsx'

export function Stepper({
  steps,
  currentIndex,
  className,
}: {
  steps: string[]
  currentIndex: number
  className?: string
}) {
  return (
    <ol className={clsx('flex flex-wrap items-center gap-2', className)}>
      {steps.map((s, i) => {
        const done = i < currentIndex
        const active = i === currentIndex
        return (
          <li
            key={s}
            className={clsx(
              'flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-bold',
              done && 'border-green-200 bg-green-50 text-green-800',
              active && 'border-gray-900 bg-gray-900 text-white',
              !done && !active && 'border-gray-200 bg-white text-gray-700'
            )}
          >
            <span
              className={clsx(
                'w-6 h-6 rounded-full grid place-items-center text-xs',
                done && 'bg-green-600 text-white',
                active && 'bg-white/15 text-white',
                !done && !active && 'bg-gray-100 text-gray-700'
              )}
            >
              {i + 1}
            </span>
            <span className="truncate max-w-[13rem]">{s}</span>
          </li>
        )
      })}
    </ol>
  )
}



