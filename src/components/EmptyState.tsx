import { EmptyKun } from '@/components/ds/kun'
import type { ReactNode } from 'react'

export type EmptyStateKind = 'not-generated' | 'zero' | 'no-results' | 'error' | 'forbidden' | 'preparing'


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
    {/* 線のさし絵の代わりに、種類に合った本物のドヤくんを置く（2026-10-29 本人の承認） */}
    <EmptyKun kind={kind} size={160} className={dark ? 'opacity-90' : ''} />
    <h2 className={`mt-5 text-xl font-black ${dark ? 'text-white' : 'text-slate-900'}`}>{title}</h2>
    {description && (
      <p className={`mt-2 max-w-md text-sm font-medium leading-relaxed ${dark ? 'text-slate-400' : 'text-slate-500'}`}>
        {description}
      </p>
    )}
    {action && <div className="mt-6">{action}</div>}
  </section>
}
