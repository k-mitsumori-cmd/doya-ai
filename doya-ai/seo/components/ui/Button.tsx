'use client'

import { type ButtonHTMLAttributes } from 'react'
import { clsx } from 'clsx'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      {...props}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-xl font-bold transition-colors disabled:opacity-60 disabled:cursor-not-allowed',
        size === 'sm' && 'px-3 py-2 text-sm',
        size === 'md' && 'px-4 py-2.5 text-sm',
        size === 'lg' && 'px-5 py-3 text-base',
        variant === 'primary' && 'bg-gray-900 text-white hover:bg-gray-800',
        variant === 'secondary' && 'bg-gray-100 text-gray-900 hover:bg-gray-200',
        variant === 'ghost' && 'bg-transparent text-gray-700 hover:bg-gray-100',
        variant === 'danger' && 'bg-red-600 text-white hover:bg-red-700',
        className
      )}
    />
  )
}


