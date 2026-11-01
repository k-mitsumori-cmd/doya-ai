'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useOrgSettingsGuard } from '@/lib/use-org-settings-guard'
import { withOrg } from '@/lib/sfa/client'
import { sfaJson } from '@/lib/sfa/client-response'
import { canExportSfaCsv } from '@/lib/sfa/export-policy'

export function SfaCsvExportLink({ orgSlug, type, className, children }: {
  orgSlug: string
  type: 'accounts' | 'deals'
  className?: string
  children: ReactNode
}) {
  const guard = useOrgSettingsGuard(orgSlug)
  const [permittedKey, setPermittedKey] = useState('')
  useEffect(() => {
    const operation = guard.begin('csv-role')
    if (!operation) return
    setPermittedKey('')
    void sfaJson('/api/sfa/usage', orgSlug, { signal: operation.signal }).then(data => {
      let expectedSlug = orgSlug
      try { expectedSlug = decodeURIComponent(orgSlug) } catch { /* Keep malformed slugs denied by the exact comparison. */ }
      const organization = data.organization
      if (operation.current() && data.onboarded === true && organization && typeof organization === 'object' && 'slug' in organization && organization.slug === expectedSlug && canExportSfaCsv(data.role)) {
        setPermittedKey(guard.key)
      }
    }).catch(() => { /* A failed role check never exposes the export link. */ }).finally(operation.end)
    return operation.end
    // The guard key captures actor, organization and authentication generation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guard.key, guard.allowed, orgSlug])

  if (!guard.allowed || permittedKey !== guard.key) return null
  return <a href={withOrg(`/api/sfa/export?type=${type}`, orgSlug)} className={className} onClick={event => {
    if (!guard.active()) event.preventDefault()
  }}>{children}</a>
}
