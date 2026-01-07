import { type HTMLAttributes } from 'react'
import { clsx } from 'clsx'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={clsx(
        'rounded-2xl border border-gray-200 bg-white shadow-sm transition-shadow duration-200 motion-reduce:transition-none',
        className
      )}
    />
  )
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={clsx('p-5 border-b border-gray-100', className)} />
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={clsx('p-5', className)} />
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p {...props} className={clsx('font-extrabold text-gray-900', className)} />
}

export function CardDesc({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p {...props} className={clsx('text-sm text-gray-500 mt-1', className)} />
}
