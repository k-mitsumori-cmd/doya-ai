import { type HTMLAttributes } from 'react'
import { clsx } from 'clsx'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={clsx(
        'rounded-2xl border border-gray-700 bg-gray-800/50 backdrop-blur-sm shadow-lg',
        className
      )}
    />
  )
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={clsx('p-5 border-b border-gray-700/50', className)} />
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={clsx('p-5', className)} />
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p {...props} className={clsx('font-extrabold text-white', className)} />
}

export function CardDesc({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p {...props} className={clsx('text-sm text-gray-400 mt-1', className)} />
}
