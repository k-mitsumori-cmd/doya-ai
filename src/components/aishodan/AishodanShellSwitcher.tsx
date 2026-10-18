'use client'

// ドヤAI商談 共通の枠に出す組織の切り替え
// ⚠️ 切り替えの中身は今のまま: 既存の OrgSwitcher（localStorage `doya.aishodan.org`・?org=・x-aishodan-org）を使う。
//    ページ本体は組織をページの中で読み込んでいるため、切り替えたあとはページを読み込み直して全部の画面を新しい組織にそろえる。
import { useEffect, useState } from 'react'
import OrgSwitcher, { getSelectedOrg, reconcileSelectedOrg, withOrg, type Membership } from '@/components/org/OrgSwitcher'

export default function AishodanShellSwitcher() {
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [currentSlug, setCurrentSlug] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const r = await fetch('/api/aishodan/organizations')
        if (!r.ok) return
        const d = await r.json()
        const list: Membership[] = Array.isArray(d.memberships) ? d.memberships : []
        let current: string | null = d.current?.slug ?? null
        if (reconcileSelectedOrg('aishodan', list)) {
          const scoped = await fetch(withOrg('aishodan', '/api/aishodan/organizations'))
          if (scoped.ok) current = (await scoped.json())?.current?.slug ?? current
        }
        if (!alive) return
        setMemberships(list)
        setCurrentSlug(getSelectedOrg('aishodan') ?? current)
      } catch {
        // 取得できないときは切り替えを出さない（ページ側が自分でエラーを出す）
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  return (
    <OrgSwitcher
      service="aishodan"
      memberships={memberships}
      currentSlug={currentSlug}
      onChange={() => window.location.reload()}
    />
  )
}
