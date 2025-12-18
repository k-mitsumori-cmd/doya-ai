import { clsx } from 'clsx'

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  const v = Math.max(0, Math.min(100, Math.round(value)))
  return (
    <div className={clsx('w-full h-2 rounded-full bg-gray-100 overflow-hidden', className)}>
      <div className="h-full bg-gray-900" style={{ width: `${v}%` }} />
    </div>
  )
}


