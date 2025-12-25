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
      // NOTE: type未指定だと、親に<form>がある場合に submit 扱いになり
      // onClickの挙動が崩れることがあるためデフォルトはbuttonにする
      type={props.type ?? 'button'}
      {...props}
      className={clsx(
        [
          'inline-flex items-center justify-center gap-2 rounded-xl font-bold',
          // micro-interactions
          'transition-all duration-200 ease-out',
          'hover:-translate-y-[1px] active:translate-y-0 active:scale-[0.99]',
          'disabled:opacity-60 disabled:cursor-not-allowed',
          'focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:ring-offset-2',
          // respect reduced motion (Tailwind)
          'motion-reduce:transform-none motion-reduce:transition-none',
        ].join(' '),
        size === 'sm' && 'px-3 py-2 text-sm',
        size === 'md' && 'px-4 py-2.5 text-sm',
        size === 'lg' && 'px-5 py-3 text-base',
        variant === 'primary' &&
          'bg-gradient-to-r from-blue-600 to-violet-600 text-white hover:from-blue-700 hover:to-violet-700 shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30',
        variant === 'secondary' && 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200',
        variant === 'ghost' && 'bg-transparent text-gray-600 hover:bg-gray-100 hover:text-gray-900',
        variant === 'danger' && 'bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-500/25',
        className
      )}
    />
  )
}
