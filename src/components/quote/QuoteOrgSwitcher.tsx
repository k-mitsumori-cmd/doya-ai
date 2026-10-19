'use client'

// 共通の枠（ToolFrame）の switcher に渡す、見積の組織の切り替え。
// 切り替えの中身（localStorage の doya.quote.org・?org=・x-quote-org）は OrgSwitcher のまま変えない。
// ⚠️ 画面本体（Tool.tsx）が持つ組織の状態は、同じタブでは quote:organization-changed を聞かず、
//    storage イベントだけを聞く。そのため切り替えたあとに storage イベントを同じタブへ送り、画面本体に再読み込みさせる。
import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import OrgSwitcher, { getSelectedOrg, orgStorageKey, reconcileSelectedOrg, type Membership } from '@/components/org/OrgSwitcher'
import { parseQuoteOrganizations } from '@/lib/quote/organization-response'

export default function QuoteOrgSwitcher() {
  const { status } = useSession()
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [currentSlug, setCurrentSlug] = useState<string | null>(null)
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    const changed = () => setRevision((n) => n + 1)
    const storage = (event: StorageEvent) => { if (event.key === null || event.key === orgStorageKey('quote')) changed() }
    window.addEventListener('quote:organization-changed', changed)
    window.addEventListener('storage', storage)
    return () => {
      window.removeEventListener('quote:organization-changed', changed)
      window.removeEventListener('storage', storage)
    }
  }, [])

  useEffect(() => {
    if (status !== 'authenticated') return
    const controller = new AbortController()
    void (async () => {
      try {
        const res = await fetch('/api/quote/organizations', { signal: controller.signal })
        if (!res.ok) return
        const data = parseQuoteOrganizations(await res.json())
        if (controller.signal.aborted) return
        reconcileSelectedOrg('quote', data.memberships)
        setMemberships(data.memberships)
        setCurrentSlug(getSelectedOrg('quote') ?? data.current?.slug ?? null)
      } catch {
        // 所属を確認できないあいだは切り替えを出さない（画面本体が別にエラーを出す）
      }
    })()
    return () => controller.abort()
  }, [status, revision])

  const onChange = useCallback(() => {
    window.dispatchEvent(new window.StorageEvent('storage', { key: orgStorageKey('quote') }))
  }, [])

  if (memberships.length <= 1) return null
  return <OrgSwitcher service="quote" memberships={memberships} currentSlug={currentSlug} onChange={onChange} />
}
