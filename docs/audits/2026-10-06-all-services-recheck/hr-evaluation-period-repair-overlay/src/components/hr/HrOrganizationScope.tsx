'use client'
import { createContext, useContext, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import { createHrOrganizationRequestScope } from '@/lib/hr/organization-request-scope'
type Scope = { actor: string; organizationId: string; request: typeof fetch; isCurrent: () => boolean }
const Context = createContext<Scope | null>(null)
export default function HrOrganizationScope({ actor, organizationId, enabled, children }: { actor: string; organizationId: string; enabled: boolean; children: ReactNode }) {
  const lease = useMemo(() => ({ active: true, transport: null as ReturnType<typeof createHrOrganizationRequestScope> | null }), [actor, organizationId])
  const latest = useRef({ lease, enabled }); latest.current = { lease, enabled }
  const scope = useMemo<Scope>(() => {
    const current = () => lease.active && latest.current.lease === lease && latest.current.enabled
    return { actor, organizationId, isCurrent: current, request: (input, init) => {
      if (!current()) return Promise.reject(Error('組織またはログイン情報が変更されました。'))
      lease.transport ??= createHrOrganizationRequestScope(actor, organizationId, window.location.origin, current)
      return lease.transport.request(input, init)
    } }
  }, [actor, organizationId, lease])
  useLayoutEffect(() => { lease.active = true; return () => { lease.active = false; lease.transport?.dispose(); lease.transport = null } }, [lease, enabled])
  return <Context.Provider value={scope}>{children}</Context.Provider>
}
export function useHrOrganizationRequest() {
  const scope = useContext(Context)
  if (!scope) throw Error('組織の通信スコープを確認できませんでした。')
  return scope
}

/** Public pricing can render before a user has an organization; it performs GET-only discovery. */
export function useOptionalHrOrganizationRequest() { return useContext(Context) }
