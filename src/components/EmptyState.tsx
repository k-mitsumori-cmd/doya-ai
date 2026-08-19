import Image from 'next/image'
import type { ReactNode } from 'react'

export type EmptyStateKind = 'not-generated' | 'zero' | 'no-results' | 'error' | 'forbidden' | 'preparing'

const ART: Record<EmptyStateKind, string> = {
  'not-generated': '/empty/not-generated.svg', zero: '/empty/zero.svg', 'no-results': '/empty/no-results.svg',
  error: '/empty/error.svg', forbidden: '/empty/forbidden.svg', preparing: '/empty/preparing.svg',
}

export function EmptyState({ kind, title, description, action }: { kind: EmptyStateKind; title: string; description?: string; action?: ReactNode }) {
  return <section className="mx-auto flex max-w-xl flex-col items-center px-5 py-10 text-center">
    <Image src={ART[kind]} alt="" width={400} height={320} className="h-auto w-full max-w-[400px]" />
    <h2 className="mt-5 text-xl font-black text-slate-900">{title}</h2>
    {description && <p className="mt-2 max-w-md text-sm font-medium leading-relaxed text-slate-500">{description}</p>}
    {action && <div className="mt-6">{action}</div>}
  </section>
}
