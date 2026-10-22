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
import { readCheckoutOriginHint, readPortalOriginHint } from '@/lib/aishodan/checkout-origin-hint'

type Scope = { kind: 'loading' | 'empty' | 'denied' | 'unavailable'; key: string } |
  { kind: 'ready'; key: string; proof: WorkspaceProof; memberships: WorkspaceOrganization[] } |
  { kind: 'select'; key: string; memberships: WorkspaceOrganization[] } |
  { kind: 'return'; key: string; memberships: WorkspaceOrganization[]; origin: WorkspaceOrganization | null }
type Value = { scope: Scope; switchTo: (slug: string) => void; retry: () => void }
type ReadyScope = Extract<Scope, { kind: 'ready' }>
const Context = createContext<Value | null>(null)
const retainNode = (node: HTMLDivElement | null) => { node?.setAttribute('inert', '') }
const releaseNode = (node: HTMLDivElement | null) => { node?.removeAttribute('inert') }

export function useOptionalOrganizationWorkspace() { return useContext(Context) }

export function useOrganizationWorkspace() {
  const value = useContext(Context)
  if (!value) throw new Error('Organization workspace boundary is missing')
  return value
}

export function useWorkspaceProof(): WorkspaceProof {
  const value = useOrganizationWorkspace()
  if (value.scope.kind !== 'ready') throw new Error('Organization workspace is not ready')
  return value.scope.proof
}

export function OrganizationWorkspaceBoundary({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession()
  const pathname = usePathname() || '/aishodan'
  const searchParams = useSearchParams()
  const searchKey = searchParams?.toString() || ''
  const router = useRouter()
  const { manager, snapshot } = useCheckoutRecovery()
  const actorId = status === 'authenticated' ? (session?.user as { id?: string } | undefined)?.id || '' : ''
  const guest = isGuestPath(pathname)
  const explicitSelection = organizationSelection(`?${searchKey}`)
  const explicitSlug = explicitSelection.kind === 'selected' ? explicitSelection.slug : null
  const portalNavigationId = /^\/aishodan\/billing-return\/([^/]+)$/.exec(pathname)?.[1] || null
  const originHint = useMemo<ReturnType<typeof readCheckoutOriginHint>>(() => {
    if (typeof window === 'undefined' || guest || status !== 'authenticated' || !actorId || explicitSelection.kind !== 'absent' || !/^\/aishodan(?:\/pricing)?$/.test(pathname)) return 'missing'
    try { return readCheckoutOriginHint(window.sessionStorage, actorId, snapshot.handle?.operationId || '') }
    catch { return 'invalid' }
  }, [guest, status, actorId, explicitSelection.kind, pathname, snapshot.handle?.operationId])
  const portalHint = useMemo<ReturnType<typeof readPortalOriginHint>>(() => {
    if (typeof window === 'undefined' || !portalNavigationId || status !== 'authenticated' || !actorId) return 'missing'
    try { return readPortalOriginHint(window.sessionStorage, actorId, portalNavigationId) }
    catch { return 'invalid' }
  }, [portalNavigationId, status, actorId])
  const returnMarker = /(?:^|&)(?:success|payment|portal_return)=/.test(searchKey)
  const returnVisit = Boolean(portalNavigationId) || explicitSelection.kind === 'absent' && /^\/aishodan(?:\/pricing)?$/.test(pathname) && (originHint !== 'missing' || returnMarker)
  const [retryNumber, setRetryNumber] = useState(0)
  const [state, setState] = useState<Scope>({ kind: 'loading', key: '' })
  const stateRef = useRef(state)
  stateRef.current = state
  const retryRetained = useRef<ReadyScope | null>(null)
  const epoch = useRef(0)
  const currentKey = JSON.stringify([actorId, status, pathname, searchKey, retryNumber, guest, returnVisit ? snapshot.handle?.operationId : null, returnVisit ? snapshot.phase : null])
  const renderedKey = useRef(currentKey)
  renderedKey.current = currentKey
  const retry = useCallback(() => {
    if (stateRef.current.kind === 'ready' && stateRef.current.proof.current()) retryRetained.current = stateRef.current
    epoch.current++; setRetryNumber(value => value + 1)
  }, [])

  useEffect(() => { if (manager && !guest) manager.inspectStored() }, [manager, guest])

  useEffect(() => {
    if (guest) return
    const revision = ++epoch.current
    const epochRef = epoch
    const controller = new AbortController()
    const active = () => !controller.signal.aborted && epoch.current === revision && renderedKey.current === currentKey
    setState(previous => {
      if (previous.kind === 'ready') {
        let priorPath: unknown = null
        try { priorPath = JSON.parse(previous.key)[2] } catch {}
        if (priorPath === pathname && (status === 'loading' || actorId === previous.proof.actorId) &&
          (explicitSelection.kind === 'selected' && explicitSlug === previous.proof.organization.slug || explicitSelection.kind === 'absent' && !returnVisit)) return previous
      }
      return { kind: 'loading', key: currentKey }
    })
    if (status === 'loading') return () => controller.abort()
    if (status !== 'authenticated' || !actorId) {
      setState({ kind: 'denied', key: currentKey })
      return () => controller.abort()
    }
    const explicit = organizationSelection(window.location.search)
    const remembered = explicit.kind === 'absent' ? getSelectedOrg('aishodan') : null
    const selected = selectedWorkspaceFromUrl(window.location.search, remembered)
    if (selected.kind === 'invalid' && !returnVisit) {
      setState({ kind: 'denied', key: currentKey })
      return () => controller.abort()
    }
    void (async () => {
      try {
        const handle = snapshot.handle
        const verifiedIntent = handle ? checkoutStoredIntent(handle, actorId, pathname, null) : null
        const validHint = typeof originHint === 'object' && handle && verifiedIntent?.serviceId === 'aishodan' && verifiedIntent.organization === null
          ? originHint : null
        const validPortalHint = portalNavigationId && typeof portalHint === 'object' ? portalHint : null
        const selectedReturnHint = portalNavigationId ? validPortalHint : validHint
        const requested = returnVisit && selectedReturnHint ? { kind: 'selected' as const, slug: selectedReturnHint.slug } : returnVisit ? { kind: 'absent' as const } : selected
        let read
        try { read = await readOrganizationWorkspace(actorId, requested, controller.signal) }
        catch (error) {
          if (!(error instanceof WorkspaceReadError && error.kind === 'denied' &&
            (returnVisit && selectedReturnHint || explicit.kind === 'absent' && remembered))) throw error
          read = await readOrganizationWorkspace(actorId, { kind: 'absent' }, controller.signal)
          if (!returnVisit) {
            if (active()) setState({ kind: 'select', key: currentKey, memberships: read.memberships })
            return
          }
        }
        if (!active()) return
        if (returnVisit) {
          const retained = selectedReturnHint && (portalNavigationId
            ? readPortalOriginHint(window.sessionStorage, actorId, portalNavigationId)
            : handle ? readCheckoutOriginHint(window.sessionStorage, actorId, handle.operationId) : 'missing')
          const sameHint = retained && typeof retained === 'object' && retained.actorId === actorId &&
            retained.organizationId === selectedReturnHint?.organizationId && retained.slug === selectedReturnHint.slug &&
            (portalNavigationId ? 'navigationId' in retained && retained.navigationId === portalNavigationId
              : handle && 'operationId' in retained && retained.operationId === handle.operationId)
          const origin = sameHint && read.current?.id === selectedReturnHint.organizationId && read.current.slug === selectedReturnHint.slug ? read.current : null
          setState({ kind: 'return', key: currentKey, memberships: read.memberships, origin })
          return
        }
        if (!read.current) {
          setState({ kind: 'empty', key: currentKey })
          return
        }
        const organization = read.current
        const proof: WorkspaceProof = {
          actorId, organization, revision,
          current: active,
          href: path => workspaceHref(path, organization.slug),
          api: path => workspaceApi(path, organization.slug),
        }
        // Only a confirmed organization can become the remembered entry hint.
        selectOrganization('aishodan', organization.slug)
        setState({ kind: 'ready', key: currentKey, proof, memberships: read.memberships })
        if (explicit.kind === 'absent') {
          const canonical = workspaceHref(`${window.location.pathname}${window.location.search}${window.location.hash}`, organization.slug)
          router.replace(canonical)
        }
      } catch (error) {
        if (active()) setState({ kind: error instanceof WorkspaceReadError && error.kind === 'denied' ? 'denied' : 'unavailable', key: currentKey })
      }
    })()
    return () => { controller.abort(); if (epochRef.current === revision) epochRef.current++ }
  }, [actorId, currentKey, guest, router, status, returnVisit, originHint, portalHint, portalNavigationId, snapshot.handle, pathname, explicitSelection.kind, explicitSlug])

  useEffect(() => {
    if (guest) return
    const hide = () => { retryRetained.current = null; epoch.current++; setState({ kind: 'loading', key: '' }) }
    const show = (event: PageTransitionEvent) => { if (event.persisted) { hide(); setRetryNumber(value => value + 1) } }
    window.addEventListener('pagehide', hide)
    window.addEventListener('pageshow', show)
    return () => { window.removeEventListener('pagehide', hide); window.removeEventListener('pageshow', show) }
  }, [guest])

  const switchTo = useCallback((slug: string) => {
    if (state.kind !== 'ready' || state.key !== currentKey || !state.proof.current() || !state.memberships.some(row => row.slug === slug)) return
    retryRetained.current = null
    epoch.current++
    setState({ kind: 'loading', key: '' })
    selectOrganization('aishodan', slug)
    const destination = /^\/aishodan\/sessions\/[^/]+$/.test(pathname) ? '/aishodan/sessions'
      : /^\/aishodan\/scenarios\/[^/]+$/.test(pathname) ? '/aishodan' : pathname
    router.push(workspaceHref(destination + (destination === pathname ? window.location.search + window.location.hash : ''), slug))
  }, [state, currentKey, pathname, router])
  const value = useMemo<Value>(() => ({ scope: state.key === currentKey && (state.kind !== 'ready' || state.proof.current()) ? state : { kind: 'loading', key: currentKey }, switchTo, retry }), [state, currentKey, switchTo, retry])
  const retryCandidate = retryRetained.current
  if (retryCandidate) {
    let priorPath: unknown = null
    try { priorPath = JSON.parse(retryCandidate.key)[2] } catch {}
    if (actorId !== retryCandidate.proof.actorId || explicitSlug !== retryCandidate.proof.organization.slug ||
        returnVisit || priorPath !== pathname) retryRetained.current = null
  }
  if (state.kind === 'ready' && state.key === currentKey && state.proof.current()) retryRetained.current = null
  const retained = state.kind === 'ready' ? state : retryRetained.current
  const priorPath = (() => { try { return JSON.parse(retained?.key || '')[2] as unknown } catch { return null } })()
  const retainSameWorkspace = retained?.kind === 'ready' && priorPath === pathname &&
    (status === 'loading' || actorId === retained.proof.actorId) &&
    (explicitSelection.kind === 'selected' && explicitSelection.slug === retained.proof.organization.slug || explicitSelection.kind === 'absent' && !returnVisit)

  if (guest) return <>{children}</>
  if (value.scope.kind === 'loading') return retainSameWorkspace && retained?.kind === 'ready' ? <Context.Provider value={{ scope: retained, switchTo, retry }}><div ref={retainNode} hidden aria-hidden="true">{children}</div><div role="status" className="mx-auto max-w-xl p-8 text-center text-sm text-slate-600">組織を確認しています…</div></Context.Provider>
    : <div role="status" className="mx-auto max-w-xl p-8 text-center text-sm text-slate-600">組織を確認しています…</div>
  if (value.scope.kind === 'denied') return <div role="alert" className="mx-auto max-w-xl space-y-3 p-8 text-center text-sm text-slate-700"><p>この組織を表示する権限を確認できませんでした。</p><SignInReturnLink fallback="/aishodan" className="text-blue-700 underline">ログイン状態を確認する</SignInReturnLink><Link href="/home" className="ml-3 text-blue-700 underline">ホームに戻る</Link></div>
  if (value.scope.kind === 'unavailable') {
    const notice = <div role="alert" className="mx-auto max-w-xl space-y-3 p-8 text-center text-sm text-slate-700"><p>組織を確認できませんでした。通信状態をご確認ください。</p><button type="button" onClick={retry} className="text-blue-700 underline">再読み込みする</button></div>
    return retainSameWorkspace && retained?.kind === 'ready' && explicitSelection.kind === 'selected'
      ? <Context.Provider value={{ scope: retained, switchTo, retry }}><div ref={retainNode} hidden aria-hidden="true">{children}</div>{notice}</Context.Provider>
      : notice
  }
  if (value.scope.kind === 'select') return <div role="status" className="mx-auto max-w-xl space-y-3 p-8 text-sm text-slate-700">
    <p>前回の組織を確認できませんでした。所属先から選んでください。</p>
    {value.scope.memberships.map(org => <Link key={org.id} href={workspaceHref('/aishodan', org.slug)} className="block font-bold text-blue-700 underline">{org.name}を開く</Link>)}
    <Link href="/home" className="block text-blue-700 underline">ホームに戻る</Link>
  </div>
  if (value.scope.kind === 'return') return <div role="status" className="mx-auto max-w-xl space-y-4 p-8 text-sm text-slate-700">
    <p>お申し込みの結果は、この画面だけでは確定しません。作業する組織を確認してから戻ってください。</p>
    {value.scope.origin ? <Link href={workspaceHref('/aishodan', value.scope.origin.slug)} className="block font-bold text-blue-700 underline">{value.scope.origin.name}の作業に戻る</Link>
      : <><p>元の組織を確認できませんでした。所属先から選んでください。</p>{value.scope.memberships.map(org => <Link key={org.id} href={workspaceHref('/aishodan', org.slug)} className="block font-bold text-blue-700 underline">{org.name}を開く</Link>)}</>}
    <Link href="/home" className="block text-blue-700 underline">ホームに戻る</Link>
  </div>
  if (value.scope.kind === 'empty' && pathname !== '/aishodan') return <div role="status" className="mx-auto max-w-xl p-8 text-center text-sm text-slate-700">所属する組織がありません。<Link href="/aishodan" className="ml-2 text-blue-700 underline">サービス画面を開く</Link></div>
  return <Context.Provider value={value}><div ref={releaseNode} style={{ display: 'contents' }}>{children}</div></Context.Provider>
}
