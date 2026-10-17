'use client'

// 空・エラー・権限なしの表示（統合仕様 §11 の状態表示）。
// ds/EmptyState が main に入ったら、同じ props のままそちらに差し替える。
import Image from 'next/image'
import Link from 'next/link'

type Tone = 'empty' | 'error' | 'forbidden'

const DEFAULT_IMAGE: Record<Tone, string> = {
  empty: '/empty/zero.svg',
  error: '/empty/error.svg',
  forbidden: '/empty/forbidden.svg',
}

export interface EmptyStateAction {
  label: string
  href?: string
  onClick?: () => void
}

export default function EmptyState({
  tone = 'empty',
  image,
  imageAlt = '',
  title,
  description,
  action,
  compact,
}: {
  tone?: Tone
  image?: string
  imageAlt?: string
  title: string
  description?: string
  action?: EmptyStateAction
  compact?: boolean
}) {
  const src = image ?? DEFAULT_IMAGE[tone]
  const btn = 'inline-flex min-h-[44px] items-center justify-center rounded-[var(--r-sm)] bg-[var(--blue)] px-5 text-sm font-bold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--blue)]'
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`flex flex-col items-center text-center ${compact ? 'gap-2 py-4' : 'gap-3 py-8'}`}>
      <Image src={src} alt={imageAlt} width={320} height={240} className={compact ? 'h-auto w-40' : 'h-auto w-56 md:w-64'} />
      <p className="text-[18px] font-bold leading-snug text-[var(--ink)]">{title}</p>
      {description && <p className="max-w-md text-[15px] leading-relaxed text-[var(--sub)]">{description}</p>}
      {action &&
        (action.href ? (
          <Link href={action.href} className={btn}>
            {action.label}
          </Link>
        ) : (
          <button type="button" onClick={action.onClick} className={btn}>
            {action.label}
          </button>
        ))}
    </div>
  )
}
