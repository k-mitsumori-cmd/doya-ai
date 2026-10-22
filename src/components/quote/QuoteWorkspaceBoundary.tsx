'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useSession } from 'next-auth/react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { getSelectedOrg, selectOrganization } from '@/components/org/OrgSwitcher'
import { isGuestPath } from '@/lib/ui/guest-path'
import { readOrganizationWorkspace, selectedWorkspaceFromUrl, WorkspaceReadError } from '@/lib/organization-workspace-client'
import { organizationSelection, workspaceApi, workspaceHref, type WorkspaceOrganization, type WorkspaceProof } from '@/lib/organization-workspace-selection'
import { useCheckoutRecovery } from '@/components/CheckoutRecoveryProvider'
import { checkoutStoredIntent } from '@/lib/checkout-recovery-client'
import { readQuoteCheckoutHint, readQuotePortalHint } from '@/lib/quote/checkout-origin-hint'

type Scope = { kind: 'loading' | 'empty' | 'denied' | 'unavailable'; key: string } |
  { kind: 'ready'; key: string; proof: WorkspaceProof; memberships: WorkspaceOrganization[] } |
  { kind: 'select'; key: string; memberships: WorkspaceOrganization[] } |
  { kind: 'return'; key: string; memberships: WorkspaceOrganization[]; origin: WorkspaceOrganization | null }
type Value = { scope: Scope; switchTo: (slug: string) => void; retry: () => void }
type RetryLease = { context: string; active: boolean }
const Context = createContext<Value | null>(null)
export function useOptionalQuoteWorkspace() { return useContext(Context) }

export function useQuoteWorkspace() {
  const value = useContext(Context)
  if (!value) throw new Error('Quote workspace boundary is missing')
  return value
}

/** No private Quote screen mounts until this actor's membership and URL scope agree. */
export function QuoteWorkspaceBoundary({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession()
  const pathname = usePathname() || '/quote'
  const search = useSearchParams()?.toString() || ''
  const router = useRouter()
  const { manager, snapshot } = useCheckoutRecovery()
  const actor = status === 'authenticated' ? (session?.user as { id?: string } | undefined)?.id || '' : ''
  const guest = isGuestPath(pathname)
  const explicit = organizationSelection(`?${search}`)
  const explicitSlug = explicit.kind === 'selected' ? explicit.slug : ''
  const portalId = /^\/quote\/billing-return\/([^/]+)$/.exec(pathname)?.[1] || null
  const [retryNumber, setRetryNumber] = useState(0)
  const checkoutHint = useMemo(() => {
    void retryNumber // Re-read sessionStorage after BFCache restoration.
    void search // A same-path checkout return can add its marker after the hint is stored.
    if (typeof window === 'undefined' || guest || status !== 'authenticated' || !actor || explicit.kind !== 'absent' || !/^\/quote(?:\/pricing)?$/.test(pathname)) return 'missing'
    try { return readQuoteCheckoutHint(window.sessionStorage, actor, snapshot.handle?.operationId || '') }
    catch { return 'invalid' }
  }, [guest, status, actor, explicit.kind, pathname, search, snapshot.handle?.operationId, retryNumber])
  const portalHint = useMemo(() => {
    void retryNumber // Re-read sessionStorage after BFCache restoration.
    if (typeof window === 'undefined' || !portalId || status !== 'authenticated' || !actor) return 'missing'
    try { return readQuotePortalHint(window.sessionStorage, actor, portalId) }
    catch { return 'invalid' }
  }, [portalId, status, actor, retryNumber])
  const marked = /(?:^|&)(?:success|payment|portal_return)=/.test(search)
  const returnVisit = Boolean(portalId) || /^\/quote(?:\/pricing)?$/.test(pathname) && (marked || explicit.kind === 'absent' && checkoutHint !== 'missing')
  const [state, setState] = useState<Scope>({ kind: 'loading', key: '' })
  const stateRef = useRef(state)
  stateRef.current = state
  const pageRetained = useRef<Scope | null>(null)
  const didPageHide = useRef(false)
  const epoch = useRef(0)
  const retryLeaseRef = useRef<RetryLease | null>(null)
  const retryHidden = useRef(false)
  const retryMounted = useRef(true)
  const [retryLeaseGeneration, refreshRetryLease] = useState(0)
  const key = JSON.stringify([actor, status, pathname, search, retryNumber, guest, returnVisit ? snapshot.handle?.operationId : null, returnVisit ? snapshot.phase : null])
  const renderedKey = useRef(key)
  renderedKey.current = key
  const retryContext = JSON.stringify([key, returnVisit, checkoutHint, portalHint, state.kind, state.key,
    state.kind === 'ready' ? state.proof.revision : null])
  const retryLease = useMemo<RetryLease>(() => ({ context: retryContext, active: true }), [retryContext, retryLeaseGeneration])
  const retry = useCallback(() => {
    if (!retryLease?.active || retryLeaseRef.current !== retryLease || retryHidden.current || !retryMounted.current) return
    retryLease.active = false
    retryLeaseRef.current = null
    epoch.current++
    setRetryNumber(value => value + 1)
  }, [retryLease])
  useLayoutEffect(() => {
    // Publish only committed callbacks. A discarded render must not retire the visible callback.
    if (!retryLease.active) { refreshRetryLease(value => value + 1); return }
    const previous = retryLeaseRef.current
    if (previous && previous !== retryLease) previous.active = false
    retryLeaseRef.current = retryLease
    retryMounted.current = true
    return () => {
      retryLease.active = false
      if (retryLeaseRef.current === retryLease) retryLeaseRef.current = null
      retryMounted.current = false
    }
  }, [retryLease])
  useEffect(() => { if (manager && !guest) manager.inspectStored() }, [manager, guest])

  useEffect(() => {
    if (guest) return
    const epochRef = epoch
    const revision = ++epochRef.current
    const controller = new AbortController()
    const active = () => !controller.signal.aborted && epochRef.current === revision && renderedKey.current === key
    setState(previous => {
      if (previous.kind === 'ready') {
        let priorPath: unknown = null
        try { priorPath = JSON.parse(previous.key)[2] } catch {}
        if (priorPath === pathname && (status === 'loading' || actor === previous.proof.actorId) &&
          (explicit.kind === 'selected' && explicitSlug === previous.proof.organization.slug || explicit.kind === 'absent' && !returnVisit)) return previous
      }
      return { kind: 'loading', key }
    })
    if (status === 'loading') return () => controller.abort()
    if (status !== 'authenticated' || !actor) {
      setState({ kind: 'denied', key })
      return () => controller.abort()
    }
    const selected = selectedWorkspaceFromUrl(`?${search}`, explicit.kind === 'absent' && !returnVisit ? getSelectedOrg('quote') : null)
    if (selected.kind === 'invalid' && !returnVisit) {
      setState({ kind: 'denied', key })
      return () => controller.abort()
    }
    void (async () => {
      try {
        const handle = snapshot.handle
        const intent = handle ? checkoutStoredIntent(handle, actor, pathname, null) : null
        const validCheckoutHint = typeof checkoutHint === 'object' && handle && intent?.serviceId === 'quote' && intent.organization === null ? checkoutHint : null
        const validPortalHint = portalId && typeof portalHint === 'object' ? portalHint : null
        const selectedHint = portalId ? validPortalHint : validCheckoutHint
        const requested = returnVisit && selectedHint ? { kind: 'selected' as const, slug: selectedHint.slug } : returnVisit ? { kind: 'absent' as const } : selected
        let read
        try { read = await readOrganizationWorkspace(actor, requested, controller.signal, 'quote') }
        catch (error) {
          if (!(error instanceof WorkspaceReadError && error.kind === 'denied' && (returnVisit && selectedHint || explicit.kind === 'absent' && selected.kind === 'selected'))) throw error
          read = await readOrganizationWorkspace(actor, { kind: 'absent' }, controller.signal, 'quote')
          if (!returnVisit) { if (active()) setState({ kind: 'select', key, memberships: read.memberships }); return }
        }
        if (!active()) return
        if (returnVisit) {
          const retained = selectedHint && (portalId ? readQuotePortalHint(window.sessionStorage, actor, portalId) : handle ? readQuoteCheckoutHint(window.sessionStorage, actor, handle.operationId) : 'missing')
          const same = retained && typeof retained === 'object' && retained.actorId === actor && retained.organizationId === selectedHint?.organizationId && retained.slug === selectedHint.slug &&
            (portalId ? 'navigationId' in retained && retained.navigationId === portalId : handle && 'operationId' in retained && retained.operationId === handle.operationId)
          const origin = same && read.current?.id === selectedHint.organizationId && read.current.slug === selectedHint.slug ? read.current : null
          setState({ kind: 'return', key, memberships: read.memberships, origin })
          return
        }
        if (!read.current) { setState({ kind: 'empty', key }); return }
        const organization = read.current
        const proof: WorkspaceProof = {
          actorId: actor, organization, revision, current: active,
          href: path => workspaceHref(path, organization.slug, 'quote'),
          api: path => workspaceApi(path, organization.slug, 'quote'),
        }
        // Storage is only an entry hint. A verified explicit URL always wins.
        if (getSelectedOrg('quote') !== organization.slug) selectOrganization('quote', organization.slug)
        setState({ kind: 'ready', key, proof, memberships: read.memberships })
        if (explicit.kind === 'absent') router.replace(proof.href(window.location.pathname + window.location.search + window.location.hash))
      } catch (error) {
        if (active()) {
          if (stateRef.current.kind === 'ready') pageRetained.current = stateRef.current
          setState({ kind: error instanceof WorkspaceReadError && error.kind === 'denied' ? 'denied' : 'unavailable', key })
        }
      }
    })()
    return () => { controller.abort(); if (epochRef.current === revision) epochRef.current++ }
  }, [actor, status, pathname, search, key, guest, router, explicit.kind, explicitSlug, returnVisit, checkoutHint, portalHint, portalId, snapshot.handle])

  useEffect(() => {
    if (guest) return
    const hide = () => { retryHidden.current = true; if (retryLeaseRef.current) retryLeaseRef.current.active = false; retryLeaseRef.current = null; didPageHide.current = true; if (stateRef.current.kind === 'ready') pageRetained.current = stateRef.current; epoch.current++; setState({ kind: 'loading', key: '' }) }
    const show = (event: PageTransitionEvent) => {
      if (!event.persisted) return
      if (retryLeaseRef.current) retryLeaseRef.current.active = false
      retryLeaseRef.current = null
      retryHidden.current = true
      if (!didPageHide.current) { pageRetained.current = null; epoch.current++; setState({ kind: 'loading', key: '' }) }
      didPageHide.current = false
      retryHidden.current = false
      setRetryNumber(value => value + 1)
    }
    window.addEventListener('pagehide', hide)
    window.addEventListener('pageshow', show)
    return () => { window.removeEventListener('pagehide', hide); window.removeEventListener('pageshow', show) }
  }, [guest])


  const switchTo = useCallback((slug: string) => {
    if (state.kind !== 'ready' || state.key !== key || !state.proof.current() || !state.memberships.some(row => row.slug === slug)) return
    const pending = new CustomEvent('quote:before-org-switch', { cancelable: true, detail: { from: state.proof.organization.slug, to: slug } })
    if (!window.dispatchEvent(pending)) return
    epoch.current++
    setState({ kind: 'loading', key: '' })
    selectOrganization('quote', slug)
    // A document ID is never reused under another organization's scope.
    const destination = /^\/quote\/documents\/[^/]+$/.test(pathname) ? '/quote' : pathname
    router.push(workspaceHref(destination, slug, 'quote'))
  }, [state, key, pathname, router])
  const value = useMemo<Value>(() => ({ scope: state.key === key && (state.kind !== 'ready' || state.proof.current()) ? state : { kind: 'loading', key }, switchTo, retry }), [state, key, switchTo, retry])

  if (guest || status === 'unauthenticated' && (pathname === '/quote' || pathname === '/quote/pricing')) return <>{children}</>
  const retained = state.kind === 'ready' ? state : pageRetained.current
  const priorPath = (() => { try { return JSON.parse(retained?.key || '')[2] as unknown } catch { return null } })()
  const retainSame = retained?.kind === 'ready' && priorPath === pathname &&
    (status === 'loading' || actor === retained.proof.actorId) &&
    (explicit.kind === 'selected' && explicitSlug === retained.proof.organization.slug || explicit.kind === 'absent' && !returnVisit)
  if (value.scope.kind === 'loading') return retainSame ? <Context.Provider value={{ scope: retained, switchTo, retry }}><div hidden aria-hidden="true">{children}</div><div role="status" className="mx-auto max-w-xl p-8 text-center text-sm text-slate-600">組織を確認しています…</div></Context.Provider>
    : <div role="status" className="mx-auto max-w-xl p-8 text-center text-sm text-slate-600">組織を確認しています…</div>
  if (value.scope.kind === 'denied') return <div role="alert" className="mx-auto max-w-xl space-y-3 p-8 text-center text-sm text-slate-700"><p>この組織を表示する権限を確認できませんでした。</p><Link href="/home" className="text-blue-700 underline">ホームに戻る</Link></div>
  if (value.scope.kind === 'unavailable') {
    const notice = <div role="alert" className="mx-auto max-w-xl space-y-3 p-8 text-center text-sm text-slate-700"><p>組織を確認できませんでした。通信状態をご確認ください。</p><button type="button" onClick={retry} className="text-blue-700 underline">再読み込みする</button></div>
    return retainSame && explicit.kind === 'selected' && retained?.kind === 'ready'
      ? <Context.Provider value={{ scope: retained, switchTo, retry }}><div hidden aria-hidden="true">{children}</div>{notice}</Context.Provider>
      : notice
  }
  if (value.scope.kind === 'select') return <div role="status" className="mx-auto max-w-xl space-y-3 p-8 text-sm text-slate-700"><p>前回の組織を確認できませんでした。所属先から選んでください。</p>{value.scope.memberships.map(org => <Link key={org.id} href={workspaceHref('/quote', org.slug, 'quote')} className="block font-bold text-blue-700 underline">{org.name}を開く</Link>)}<Link href="/home" className="block text-blue-700 underline">ホームに戻る</Link></div>
  if (value.scope.kind === 'return') return <div role="status" className="mx-auto max-w-xl space-y-4 p-8 text-sm text-slate-700"><p>お申し込みの結果は、この画面だけでは確定しません。作業する組織を確認してから戻ってください。</p>{value.scope.origin ? <Link href={workspaceHref('/quote', value.scope.origin.slug, 'quote')} className="block font-bold text-blue-700 underline">{value.scope.origin.name}の作業に戻る</Link> : <><p>元の組織を確認できませんでした。所属先から選んでください。</p>{value.scope.memberships.map(org => <Link key={org.id} href={workspaceHref('/quote', org.slug, 'quote')} className="block font-bold text-blue-700 underline">{org.name}を開く</Link>)}</>}<Link href="/home" className="block text-blue-700 underline">ホームに戻る</Link></div>
  if (value.scope.kind === 'empty' && pathname !== '/quote') return <div role="status" className="mx-auto max-w-xl p-8 text-center text-sm text-slate-700">所属する組織がありません。<Link href="/quote" className="ml-2 text-blue-700 underline">サービス画面を開く</Link></div>
  return <Context.Provider value={value}><div style={{ display: 'contents' }}>{children}</div></Context.Provider>
}
