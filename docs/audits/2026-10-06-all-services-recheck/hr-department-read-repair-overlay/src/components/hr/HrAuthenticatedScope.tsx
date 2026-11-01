'use client'
import { Fragment, useRef, type ReactNode } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
export default function HrAuthenticatedScope({ children, callbackUrl }: { children: (actor: string) => ReactNode; callbackUrl: string }) {
  const { data: session, status } = useSession()
  const actor = (session?.user as { id?: string } | undefined)?.id ?? ''
  const scope = JSON.stringify([status, actor]), epoch = useRef({ scope, version: 0 })
  if (epoch.current.scope !== scope) epoch.current = { scope, version: epoch.current.version + 1 }
  if (status === 'loading') return <p role="status">認証情報を確認しています。</p>
  if (status !== 'authenticated' || !actor) return <div role="alert">従業員情報を確認するにはログインしてください。<Link href={'/auth/signin?callbackUrl=' + encodeURIComponent(callbackUrl)}>ログインする</Link></div>
  return <Fragment key={JSON.stringify([actor, epoch.current.version])}>{children(actor)}</Fragment>
}
