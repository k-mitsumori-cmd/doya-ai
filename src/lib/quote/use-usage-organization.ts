'use client'

import { useEffect, useRef, useState } from 'react'
import { getSelectedOrg, orgStorageKey } from '@/components/org/OrgSwitcher'
import { requestOrgJson } from '@/lib/org-client-response'
import { parseQuoteOrganizations } from '@/lib/quote/organization-response'

/** Confirm organization scope before the sidebar can request private usage. */
export function useQuoteUsageOrganization(actor: string, status: string) {
  const [revision, setRevision] = useState(0)
  const selection = getSelectedOrg('quote')
  const scope = JSON.stringify([actor, status, selection, revision])
  const epoch = useRef({ scope, version: 0 })
  if (epoch.current.scope !== scope) epoch.current = { scope, version: epoch.current.version + 1 }
  const key = JSON.stringify([scope, epoch.current.version])
  const liveKey = useRef(key)
  liveKey.current = key
  const [confirmed, setConfirmed] = useState<{ key: string; slug: string } | null>(null)

  useEffect(() => {
    const changed = () => setRevision((n) => n + 1)
    const storage = (event: StorageEvent) => { if (event.key === null || event.key === orgStorageKey('quote')) changed() }
    window.addEventListener('quote:organization-changed', changed)
    window.addEventListener('storage', storage)
    window.addEventListener('focus', changed)
    return () => {
      window.removeEventListener('quote:organization-changed', changed)
      window.removeEventListener('storage', storage)
      window.removeEventListener('focus', changed)
    }
  }, [])

  useEffect(() => {
    if (status !== 'authenticated' || !actor) return
    const controller = new AbortController()
    const current = () => !controller.signal.aborted && liveKey.current === key && getSelectedOrg('quote') === selection
    void Promise.resolve().then(async () => {
      if (!current()) return
      try {
        const { res, data } = await requestOrgJson('quote', '/api/quote/organizations', selection, { signal: controller.signal })
        if (!current() || !res.ok) return
        const organization = parseQuoteOrganizations(data).current
        if (!organization || selection !== null && organization.slug !== selection) return
        setConfirmed({ key, slug: organization.slug })
      } catch {
        // Unverified membership must not become an implicit/default usage request.
      }
    })
    return () => controller.abort()
  }, [actor, status, selection, key])

  return status === 'authenticated' && actor && confirmed?.key === key ? confirmed.slug : null
}
