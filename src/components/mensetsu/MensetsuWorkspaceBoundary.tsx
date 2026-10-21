'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useSession } from 'next-auth/react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import SignInReturnLink from '@/components/SignInReturnLink'
import { getSelectedOrg, selectOrganization } from '@/components/org/OrgSwitcher'
import { isGuestPath } from '@/lib/ui/guest-path'
import { readOrganizationWorkspace, selectedWorkspaceFromUrl, WorkspaceReadError } from '@/lib/organization-workspace-client'
import { organizationSelection, workspaceApi, workspaceHref, type WorkspaceOrganization, type WorkspaceProof } from '@/lib/organization-workspace-selection'
import { useCheckoutRecovery } from '@/components/CheckoutRecoveryProvider'
import { checkoutStoredIntent } from '@/lib/checkout-recovery-client'
import { readMensetsuCheckoutHint, readMensetsuPortalHint } from '@/lib/mensetsu/checkout-origin-hint'

type Scope = { kind: 'loading' | 'denied' | 'unavailable'; key: string } |
  { kind: 'empty'; key: string; actorId: string; current: () => boolean } |
  { kind: 'ready'; key: string; proof: WorkspaceProof; memberships: WorkspaceOrganization[] } |
  { kind: 'select'; key: string; memberships: WorkspaceOrganization[] } |
  { kind: 'return'; key: string; memberships: WorkspaceOrganization[]; origin: WorkspaceOrganization | null }
type Value = { scope: Scope; switchTo: (slug: string) => void; retry: () => void; suspended?: boolean }
const Context = createContext<Value | null>(null)
const retainNode = (node: HTMLDivElement | null) => { node?.setAttribute('inert', '') }
const releaseNode = (node: HTMLDivElement | null) => { node?.removeAttribute('inert') }

export function useOptionalMensetsuWorkspace() { return useContext(Context) }
export function useMensetsuWorkspace() {
  const value = useContext(Context)
  if (!value) throw new Error('Mensetsu workspace boundary is missing')
  return value
}
export function useMensetsuProof(): WorkspaceProof {
  const { scope } = useMensetsuWorkspace()
  if (scope.kind !== 'ready') throw new Error('Mensetsu workspace is not ready')
  return scope.proof
}

/** Staff screens mount only after the actual actor and selected Mensetsu membership agree. */
export function MensetsuWorkspaceBoundary({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession()
  const pathname = usePathname() || '/mensetsu'
  const search = useSearchParams()?.toString() || ''
  const router = useRouter()
  const { manager, snapshot } = useCheckoutRecovery()
  const actor = status === 'authenticated' ? (session?.user as { id?: string } | undefined)?.id || '' : ''
  const guest = isGuestPath(pathname)
  const explicit = organizationSelection(`?${search}`)
  const explicitSlug = explicit.kind === 'selected' ? explicit.slug : ''
  const portalId = /^\/mensetsu\/billing-return\/([^/]+)$/.exec(pathname)?.[1] || null
  const [retryNumber, setRetryNumber] = useState(0)
  const checkoutHint = useMemo(() => {
    void retryNumber
    void search // A same-path return marker can be added after the hint is saved.
    if (typeof window === 'undefined' || guest || status !== 'authenticated' || !actor || explicit.kind !== 'absent' || !/^\/mensetsu(?:\/pricing)?$/.test(pathname)) return 'missing'
    try { return readMensetsuCheckoutHint(window.sessionStorage, actor, snapshot.handle?.operationId || '') }
    catch { return 'invalid' }
  }, [retryNumber, guest, status, actor, explicit.kind, pathname, search, snapshot.handle?.operationId])
  const portalHint = useMemo(() => {
    void retryNumber
    if (typeof window === 'undefined' || !portalId || status !== 'authenticated' || !actor) return 'missing'
    try { return readMensetsuPortalHint(window.sessionStorage, actor, portalId) }
    catch { return 'invalid' }
  }, [retryNumber, portalId, status, actor])
  const marked = /(?:^|&)(?:success|payment|portal_return)=/.test(search)
  const returnVisit = Boolean(portalId) || /^\/mensetsu(?:\/pricing)?$/.test(pathname) && (marked || explicit.kind === 'absent' && checkoutHint !== 'missing')
  const [state, setState] = useState<Scope>({ kind: 'loading', key: '' })
  const stateRef = useRef(state)
  stateRef.current = state
  const pageRetained = useRef<Scope | null>(null)
  const didPageHide = useRef(false)
  const epoch = useRef(0)
  const key = JSON.stringify([actor, status, pathname, search, retryNumber, guest, returnVisit ? snapshot.handle?.operationId : null, returnVisit ? snapshot.phase : null])
  const renderedKey = useRef(key)
  renderedKey.current = key
  const retry = useCallback(() => { epoch.current++; setRetryNumber(value => value + 1) }, [])
  useEffect(() => { if (manager && !guest) manager.inspectStored() }, [manager, guest])

  useEffect(() => {
    if (guest || status === 'unauthenticated' && (pathname === '/mensetsu' || pathname === '/mensetsu/pricing')) return
    const revision = ++epoch.current
    const epochRef = epoch
    const controller = new AbortController()
    const active = () => !controller.signal.aborted && epoch.current === revision && renderedKey.current === key
    setState(previous => {
      if (previous.kind === 'ready' || previous.kind === 'empty') {
        let priorPath: unknown = null
        try { priorPath = JSON.parse(previous.key)[2] } catch {}
        if (priorPath === pathname && (status === 'loading' || actor === (previous.kind === 'ready' ? previous.proof.actorId : previous.actorId)) &&
          (previous.kind === 'ready' && explicit.kind === 'selected' && explicitSlug === previous.proof.organization.slug ||
            explicit.kind === 'absent' && !returnVisit)) return previous
      }
      return { kind: 'loading', key }
    })
    if (status === 'loading') return () => controller.abort()
    if (status !== 'authenticated' || !actor) {
      setState({ kind: 'denied', key })
      return () => controller.abort()
    }
    const selected = selectedWorkspaceFromUrl(`?${search}`, explicit.kind === 'absent' && !returnVisit ? getSelectedOrg('mensetsu') : null)
    if (explicit.kind === 'invalid' || selected.kind === 'invalid') {
      setState({ kind: 'denied', key })
      return () => controller.abort()
    }
    void (async () => {
      try {
        const handle = snapshot.handle
        const intent = handle ? checkoutStoredIntent(handle, actor, pathname, null) : null
        const validCheckoutHint = typeof checkoutHint === 'object' && handle && intent?.serviceId === 'mensetsu' && intent.organization === null ? checkoutHint : null
        const validPortalHint = portalId && typeof portalHint === 'object' ? portalHint : null
        const selectedHint = portalId ? validPortalHint : validCheckoutHint
        const requested = returnVisit && selectedHint ? { kind: 'selected' as const, slug: selectedHint.slug } : returnVisit ? { kind: 'absent' as const } : selected
        let read
        try { read = await readOrganizationWorkspace(actor, requested, controller.signal, 'mensetsu') }
        catch (error) {
          // A stale remembered hint is never silently replaced by another organization.
          if (!(error instanceof WorkspaceReadError && error.kind === 'denied' &&
            (returnVisit && selectedHint || explicit.kind === 'absent' && selected.kind === 'selected'))) throw error
          read = await readOrganizationWorkspace(actor, { kind: 'absent' }, controller.signal, 'mensetsu')
          if (!returnVisit) { if (active()) setState({ kind: 'select', key, memberships: read.memberships }); return }
        }
        if (!active()) return
        if (returnVisit) {
          const retained = selectedHint && (portalId ? readMensetsuPortalHint(window.sessionStorage, actor, portalId)
            : handle ? readMensetsuCheckoutHint(window.sessionStorage, actor, handle.operationId) : 'missing')
          const same = retained && typeof retained === 'object' && retained.actorId === actor && retained.organizationId === selectedHint?.organizationId && retained.slug === selectedHint.slug &&
            (portalId ? 'navigationId' in retained && retained.navigationId === portalId : handle && 'operationId' in retained && retained.operationId === handle.operationId)
          const origin = same && read.current?.id === selectedHint.organizationId && read.current.slug === selectedHint.slug ? read.current : null
          setState({ kind: 'return', key, memberships: read.memberships, origin })
          return
        }
        if (!read.current) { setState({ kind: 'empty', key, actorId: actor, current: active }); return }
        const organization = read.current
        const proof: WorkspaceProof = {
          actorId: actor, organization, revision, current: active,
          href: path => workspaceHref(path, organization.slug, 'mensetsu'),
          api: path => workspaceApi(path, organization.slug, 'mensetsu'),
        }
        if (getSelectedOrg('mensetsu') !== organization.slug) selectOrganization('mensetsu', organization.slug)
        setState({ kind: 'ready', key, proof, memberships: read.memberships })
        if (explicit.kind === 'absent') router.replace(proof.href(window.location.pathname + window.location.search + window.location.hash))
      } catch (error) {
        if (active()) {
          if (stateRef.current.kind === 'ready' || stateRef.current.kind === 'empty') pageRetained.current = stateRef.current
          setState({ kind: error instanceof WorkspaceReadError && error.kind === 'denied' ? 'denied' : 'unavailable', key })
        }
      }
    })()
    return () => { controller.abort(); if (epochRef.current === revision) epochRef.current++ }
  }, [actor, status, pathname, search, key, guest, router, explicit.kind, explicitSlug, returnVisit, checkoutHint, portalHint, portalId, snapshot.handle])

  useEffect(() => {
    if (guest) return
    const hide = () => { didPageHide.current = true; if (stateRef.current.kind === 'ready' || stateRef.current.kind === 'empty') pageRetained.current = stateRef.current; epoch.current++; setState({ kind: 'loading', key: '' }) }
    const show = (event: PageTransitionEvent) => {
      if (!event.persisted) return
      if (!didPageHide.current) {
        // BFCache may deliver persisted pageshow without a matching pagehide.
        // Retire the proof immediately, but keep this actor's mounted draft inert
        // until a fresh workspace read confirms the same selected organization.
        const current = stateRef.current
        pageRetained.current = current.kind === 'ready' || current.kind === 'empty' ? current : null
        epoch.current++
        setState({ kind: 'loading', key: '' })
      }
      didPageHide.current = false
      setRetryNumber(value => value + 1)
    }
    window.addEventListener('pagehide', hide)
    window.addEventListener('pageshow', show)
    return () => { window.removeEventListener('pagehide', hide); window.removeEventListener('pageshow', show) }
  }, [guest])

  useEffect(() => {
    const retained = pageRetained.current
    if (retained && (retained.kind === 'ready' || retained.kind === 'empty') && status === 'authenticated' && actor !== (retained.kind === 'ready' ? retained.proof.actorId : retained.actorId)) pageRetained.current = null
  }, [actor, status])

  const switchTo = useCallback((slug: string) => {
    if (state.kind !== 'ready' || state.key !== key || !state.proof.current() || !state.memberships.some(row => row.slug === slug)) return
    epoch.current++
    pageRetained.current = null
    setState({ kind: 'loading', key: '' })
    const destination = /^\/mensetsu\/(?:templates|sessions)\/[^/]+$/.test(pathname) ? '/mensetsu' : pathname
    router.push(workspaceHref(destination, slug, 'mensetsu'))
  }, [state, key, pathname, router])
  const value = useMemo<Value>(() => ({ scope: state.key === key && (state.kind !== 'ready' && state.kind !== 'empty' || (state.kind === 'ready' ? state.proof.current() : state.current())) ? state : { kind: 'loading', key }, switchTo, retry }), [state, key, switchTo, retry])

  if (guest) return <>{children}</>
  // The server renders the public LP at the root. If an already mounted staff tree
  // loses its session before navigation, keep its legacy 401-to-LP path mounted.
  if (status === 'unauthenticated' && (pathname === '/mensetsu' || pathname === '/mensetsu/pricing')) {
    return <Context.Provider value={{ scope: { kind: 'empty', key, actorId: '', current: () => false }, switchTo: () => {}, retry }}>{children}</Context.Provider>
  }
  const retained = state.kind === 'ready' || state.kind === 'empty' ? state : pageRetained.current
  const priorPath = (() => { try { return JSON.parse(retained?.key || '')[2] as unknown } catch { return null } })()
  const retainSame = (retained?.kind === 'ready' || retained?.kind === 'empty') && priorPath === pathname &&
    (status === 'loading' || actor === (retained.kind === 'ready' ? retained.proof.actorId : retained.actorId)) &&
    (retained.kind === 'ready' && explicit.kind === 'selected' && explicitSlug === retained.proof.organization.slug ||
      explicit.kind === 'absent' && !returnVisit && (retained.kind === 'ready' || pathname === '/mensetsu'))
  const retainedKey = retained?.kind === 'ready' ? `${retained.proof.actorId}:${retained.proof.organization.id}` : retained?.kind === 'empty' ? `empty:${retained.actorId}` : 'empty'
  if (value.scope.kind === 'loading') return retainSame
    ? <Context.Provider value={{ scope: retained, switchTo, retry, suspended: true }}><div key={retainedKey} ref={retainNode} hidden aria-hidden="true">{children}</div><div role="status" className="mx-auto max-w-xl p-8 text-center text-sm text-slate-600">組織を確認しています…</div></Context.Provider>
    : <div role="status" className="mx-auto max-w-xl p-8 text-center text-sm text-slate-600">組織を確認しています…</div>
  if (value.scope.kind === 'denied') return <div role="alert" className="mx-auto max-w-xl space-y-3 p-8 text-center text-sm text-slate-700"><p>この組織を表示する権限を確認できませんでした。</p><SignInReturnLink fallback="/mensetsu" className="text-blue-700 underline">ログイン状態を確認する</SignInReturnLink></div>
  if (value.scope.kind === 'unavailable') {
    const notice = <div role="alert" className="mx-auto max-w-xl space-y-3 p-8 text-center text-sm text-slate-700"><p>組織を確認できませんでした。通信状態をご確認ください。</p><button type="button" onClick={retry} className="text-blue-700 underline">再読み込みする</button></div>
    return retainSame && (retained?.kind === 'empty' || explicit.kind === 'selected' && retained?.kind === 'ready')
      ? <Context.Provider value={{ scope: retained, switchTo, retry, suspended: true }}><div key={retainedKey} ref={retainNode} hidden aria-hidden="true">{children}</div>{notice}</Context.Provider>
      : notice
  }
  if (value.scope.kind === 'select') return <div role="status" className="mx-auto max-w-xl space-y-3 p-8 text-sm text-slate-700"><p>前回の組織を確認できませんでした。所属先から選んでください。</p>{value.scope.memberships.map(org => <Link key={org.id} href={workspaceHref('/mensetsu', org.slug, 'mensetsu')} className="block font-bold text-blue-700 underline">{org.name}を開く</Link>)}</div>
  if (value.scope.kind === 'return') return <div role="status" className="mx-auto max-w-xl space-y-4 p-8 text-sm text-slate-700"><p>お申し込みの結果は、この画面だけでは確定しません。作業する組織を確認してから戻ってください。</p>{value.scope.origin ? <Link href={workspaceHref('/mensetsu', value.scope.origin.slug, 'mensetsu')} className="block font-bold text-blue-700 underline">{value.scope.origin.name}の作業に戻る</Link> : <><p>元の組織を確認できませんでした。所属先から選んでください。</p>{value.scope.memberships.map(org => <Link key={org.id} href={workspaceHref('/mensetsu', org.slug, 'mensetsu')} className="block font-bold text-blue-700 underline">{org.name}を開く</Link>)}</>}</div>
  if (value.scope.kind === 'empty' && pathname !== '/mensetsu') return <div role="status" className="mx-auto max-w-xl p-8 text-center text-sm text-slate-700">所属する組織がありません。<Link href="/mensetsu" className="ml-2 text-blue-700 underline">サービス画面を開く</Link></div>
  return <Context.Provider value={value}><div key={value.scope.kind === 'ready' ? `${value.scope.proof.actorId}:${value.scope.proof.organization.id}` : value.scope.kind === 'empty' ? `empty:${value.scope.actorId}` : 'empty'} ref={releaseNode} style={{ display: 'contents' }}>{children}</div></Context.Provider>
}
