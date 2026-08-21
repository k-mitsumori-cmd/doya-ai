import Image from 'next/image'
import type { ReactNode } from 'react'

export type EmptyStateKind = 'not-generated' | 'zero' | 'no-results' | 'error' | 'forbidden' | 'preparing'

const ART: Record<EmptyStateKind, string> = {
  'not-generated': '/empty/not-generated.svg', zero: '/empty/zero.svg', 'no-results': '/empty/no-results.svg',
  error: '/empty/error.svg', forbidden: '/empty/forbidden.svg', preparing: '/empty/preparing.svg',
}

/**
 * 空状態の表示。
 * ⚠️ tone は必ず背景に合わせること。既定の 'light' を暗色背景の画面で使うと
 *    見出しが text-slate-900 になり、文字が背景に沈んで読めなくなる。
 */
export function EmptyState({
  kind, title, description, action, tone = 'light',
}: {
  kind: EmptyStateKind
  title: string
  description?: string
  action?: ReactNode
  tone?: 'light' | 'dark'
}) {
  const dark = tone === 'dark'
  return <section className="mx-auto flex max-w-xl flex-col items-center px-5 py-10 text-center">
    <Image src={ART[kind]} alt="" width={400} height={320} className={`h-auto w-full max-w-[400px] ${dark ? 'opacity-90' : ''}`} />
    <h2 className={`mt-5 text-xl font-black ${dark ? 'text-white' : 'text-slate-900'}`}>{title}</h2>
    {description && (
      <p className={`mt-2 max-w-md text-sm font-medium leading-relaxed ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
        {description}
      </p>
    )}
    {action && <div className="mt-6">{action}</div>}
  </section>
}
