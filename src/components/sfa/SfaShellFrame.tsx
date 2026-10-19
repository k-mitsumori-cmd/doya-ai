'use client'

// ============================================
// ドヤ営業管理: 共通シェル（AppShell＋ToolFrame）に載せる枠
// ============================================
// フラグ ui.shell.sfa が ON のときだけ src/app/(shell)/sfa/layout.tsx から使う（OFF の間は [orgSlug]/layout.tsx のサイドバー）。
// ⚠️ 枠（AppShell）は src/app/(shell)/layout.tsx が出す。ここでは ToolFrame だけ。AppShell で包まない。
// ⚠️ 組織の layout（[orgSlug]/layout.tsx）が取った所属組織の一覧を、文脈経由で受けて switcher に渡す。
import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { useParams } from 'next/navigation'
import ToolFrame from '@/components/shell/ToolFrame'
import SfaOrgSwitcher from '@/components/sfa/SfaOrgSwitcher'
import { sfaNav } from '@/lib/sfa/nav'
import styles from './SfaShellFrame.module.css'
import { SfaShellContext, type SfaShellContextValue, type SfaShellMembership } from '@/lib/sfa/shell-context'

export default function SfaShellFrame({ children }: { children: ReactNode }) {
  const params = useParams()
  const orgSlug = typeof params?.orgSlug === 'string' ? params.orgSlug : ''
  const [memberships, setMemberships] = useState<SfaShellMembership[]>([])
  const publishMemberships = useCallback((next: SfaShellMembership[]) => setMemberships(next), [])
  const value = useMemo<SfaShellContextValue>(() => ({ publishMemberships }), [publishMemberships])

  // 組織の外（/sfa の入口など）は枠の対象外。台帳（registry.ts）の inShell と同じ条件で、ここでも ToolFrame を出さない
  if (!orgSlug) return <>{children}</>
  return (
    <SfaShellContext.Provider value={value}>
      <ToolFrame
        serviceId="sfa"
        nav={sfaNav(orgSlug)}
        switcher={<SfaOrgSwitcher orgSlug={orgSlug} memberships={memberships} />}
      >
        {/* 新しい見た目のときだけ、中の緑をブランドの青に置き換える（SfaShellFrame.module.css） */}
        <div className={styles.content}>{children}</div>
      </ToolFrame>
    </SfaShellContext.Provider>
  )
}
