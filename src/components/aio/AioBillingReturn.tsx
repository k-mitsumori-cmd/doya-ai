'use client'

import { useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { AioNavigationReadError, readAioBillingNavigation } from '@/lib/aio/billing-navigation-client'
import { readAioCheckoutHint, readAioPortalHint, type AioBillingRead, type AioCheckoutHint, type AioPortalHint } from '@/lib/aio/billing-navigation'
import { aioDedicatedReturnMarkerValid, aioUnknownReturnPath } from '@/lib/aio/billing-return-route'

type Kind = 'checkout' | 'portal' | 'cancelled' | 'unknown'
type View = { key: string; read: AioBillingRead; origin: { id: string; slug: string } | null }

export function AioBillingReturn({ kind, referenceId }: { kind: Kind; referenceId: string | null }) {
  const search = useSearchParams()
  const router = useRouter()
  const { data: session, status } = useSession()
  const actorId = status === 'authenticated' ? (session?.user as { id?: string } | undefined)?.id || '' : ''
  const marker: Record<string, string | string[] | undefined> = {}
  for (const field of ['success', 'payment', 'portal_return', 'session_id', 'plan']) {
    const values = search.getAll(field)
    marker[field] = values.length === 0 ? undefined : values.length === 1 ? values[0] : values
  }
  const rejected = useRef(new Map<string, string>())
  const markerIdentity = JSON.stringify([kind, referenceId])
  const returnPath = kind === 'checkout' && referenceId ? `/aio/billing-return/checkout/${encodeURIComponent(referenceId)}` :
    kind === 'portal' && referenceId ? `/aio/billing-return/portal/${encodeURIComponent(referenceId)}` :
      `/aio/billing-return/${kind}`
  if (!aioDedicatedReturnMarkerValid(kind, referenceId, marker) && !rejected.current.has(markerIdentity))
    rejected.current.set(markerIdentity, aioUnknownReturnPath(marker, returnPath))
  const markerSafe = !rejected.current.has(markerIdentity)
  const key = JSON.stringify([status, actorId, kind, referenceId, marker])
  const latest = useRef(key); latest.current = key
  const [view, setView] = useState<View | null>(null)
  const [errorKey, setErrorKey] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  const epoch = useRef(0)
  useEffect(() => {
    const own = ++epoch.current
    const controller = new AbortController()
    const retire = () => { if (epoch.current === own) epoch.current++; controller.abort() }
    const show = (event: PageTransitionEvent) => { if (event.persisted) { retire(); setView(null); setErrorKey(null); setRetry(value => value + 1) } }
    window.addEventListener('pagehide', retire)
    window.addEventListener('pageshow', show)
    if (!markerSafe) router.replace(rejected.current.get(markerIdentity) || '/aio/billing-return/unknown')
    if (status === 'authenticated' && actorId) {
      let hint: AioCheckoutHint | AioPortalHint | null = null
      try {
        if (markerSafe) hint = kind === 'checkout' && referenceId ? readAioCheckoutHint(sessionStorage, actorId, referenceId) :
          kind === 'portal' && referenceId ? readAioPortalHint(sessionStorage, actorId, referenceId) : null
      } catch { /* Storage access may be denied; a selector remains available. */ }
      // First read the current actor's memberships. An old hint never grants membership.
      void readAioBillingNavigation(actorId, null, controller.signal).then(async read => {
        if (controller.signal.aborted || own !== epoch.current || latest.current !== key) return
        let origin: View['origin'] = null
        if (hint && read.memberships.some(row => row.id === hint.organizationId && row.slug === hint.slug)) {
          try {
            const scoped = await readAioBillingNavigation(actorId, hint.slug, controller.signal)
            if (scoped.current?.id === hint.organizationId && scoped.current.slug === hint.slug) origin = { id: hint.organizationId, slug: hint.slug }
          } catch (failure) {
            if (!(failure instanceof AioNavigationReadError) || ![403, 404, 409].includes(failure.status)) throw failure
          }
        }
        if (controller.signal.aborted || own !== epoch.current || latest.current !== key) return
        setView({ key, read, origin }); setErrorKey(null)
      }).catch(() => { if (!controller.signal.aborted && own === epoch.current && latest.current === key) setErrorKey(key) })
    }
    return () => { retire(); window.removeEventListener('pagehide', retire); window.removeEventListener('pageshow', show) }
  }, [key, actorId, status, kind, referenceId, retry, markerSafe, router, markerIdentity])

  let callback = !markerSafe ? '/aio/billing-return/unknown' : kind === 'checkout' && referenceId ? `/aio/billing-return/checkout/${encodeURIComponent(referenceId)}` :
    kind === 'portal' && referenceId ? `/aio/billing-return/portal/${encodeURIComponent(referenceId)}` :
      `/aio/billing-return/${kind}`
  if (markerSafe && kind === 'checkout' && referenceId && search.get('success') === 'true' && search.get('session_id') === referenceId &&
    search.getAll('session_id').length === 1 && search.getAll('success').length === 1) {
    const preserved = new URLSearchParams({ success: 'true', session_id: referenceId })
    const plan = search.get('plan')
    if (plan && search.getAll('plan').length === 1 && /^[A-Za-z0-9_-]{1,80}$/.test(plan)) preserved.set('plan', plan)
    callback += `?${preserved}`
  } else if (markerSafe && kind === 'portal' && search.get('portal_return') === 'plan_change' && search.getAll('portal_return').length === 1) {
    callback += '?portal_return=plan_change'
  } else if (markerSafe && kind === 'unknown') {
    callback = aioUnknownReturnPath(marker)
  }
  if (status === 'loading') return <p role="status">ログイン状態を確認しています…</p>
  if (status !== 'authenticated' || !actorId) return <main className="mx-auto max-w-xl p-8"><h1>ドヤAIOの戻り先</h1>
    <p>ログインして所属する組織を確認してください。</p><Link href={`/auth/signin?callbackUrl=${encodeURIComponent(callback)}`}>ログインする</Link></main>
  const retryEpoch = epoch.current
  const retryCurrent = () => epoch.current === retryEpoch && latest.current === key && status === 'authenticated' && actorId
  if (errorKey === key) return <main className="mx-auto max-w-xl p-8" role="alert"><h1>組織を確認できませんでした</h1>
    <button type="button" onClick={() => { if (!retryCurrent()) return; setErrorKey(null); setView(null); setRetry(value => value + 1) }}>再確認する</button>
    <Link href="/">ホームへ戻る</Link></main>
  if (view?.key !== key) return <p role="status">所属する組織を確認しています…</p>
  return <main className="mx-auto max-w-xl space-y-5 p-8">
    <h1 className="text-2xl font-bold">ドヤAIOの戻り先</h1>
    <p>契約の結果は契約画面で確認してください。ここでは作業する組織を選べます。</p>
    {view.origin ? <p><Link href={`/aio/${encodeURIComponent(view.origin.slug)}`}>元の組織の作業画面に戻る</Link></p> :
      <p>元の組織を確認できませんでした。現在所属する組織から選んでください。</p>}
    <nav aria-label="所属する組織"><ul>{view.read.memberships.map(row => <li key={row.id}>
      <Link href={`/aio/${encodeURIComponent(row.slug)}`}>{row.name}</Link>
    </li>)}</ul></nav>
    {view.read.memberships.length === 0 && <p>現在選べる組織はありません。</p>}
    <Link href="/">ホームへ戻る</Link>
  </main>
}
