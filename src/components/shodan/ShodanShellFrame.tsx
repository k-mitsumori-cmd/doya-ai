'use client'

// ============================================
// ドヤ商談準備: 共通シェル（ToolFrame）に載せる枠
// ============================================
// UI_SHELL_SERVICES に shodan があるときだけ layout.tsx から使う（無い間は ShodanAppLayout）。
// ⚠️ 枠（AppShell）は src/app/(shell)/layout.tsx が出す。ここではツール内のナビ（ToolFrame）だけ。AppShell で包まない
import type { ReactNode } from 'react'
import ToolFrame from '@/components/shell/ToolFrame'
import { shodanNav } from '@/lib/shodan/nav'
import ShodanOrgSwitcher from './ShodanOrgSwitcher'
import styles from './ShodanShellFrame.module.css'

export default function ShodanShellFrame({ orgSlug, orgName, children }: { orgSlug: string; orgName?: string; children: ReactNode }) {
  return (
    <ToolFrame serviceId="shodan" nav={shodanNav(orgSlug)} switcher={<ShodanOrgSwitcher orgSlug={orgSlug} orgName={orgName} />}>
      {/* 新しい見た目のときだけ、中の紫をブランドの青に置き換える（ShodanShellFrame.module.css） */}
      <div className={styles.content}>{children}</div>
    </ToolFrame>
  )
}
