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
        'inline-flex items-center justify-center gap-2 rounded-xl font-bold transition-colors disabled:opacity-60 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:ring-offset-2 focus:ring-offset-transparent',
        size === 'sm' && 'px-3 py-2 text-sm',
        size === 'md' && 'px-4 py-2.5 text-sm',
        size === 'lg' && 'px-5 py-3 text-base',
        // Spotifyっぽい主CTA（どの背景でも映える）
        variant === 'primary' &&
          'bg-emerald-400 text-[#0b0f14] hover:bg-emerald-300 shadow-[0_10px_30px_-12px_rgba(16,185,129,0.6)]',
        variant === 'secondary' && 'bg-gray-100 text-gray-900 hover:bg-gray-200',
        variant === 'ghost' && 'bg-transparent text-gray-700 hover:bg-gray-100',
        variant === 'danger' && 'bg-red-600 text-white hover:bg-red-700',
        className
      )}
    />
  )
}


