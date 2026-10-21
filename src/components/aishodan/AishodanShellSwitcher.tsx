'use client'

// ドヤAI商談 共通の枠に出す組織の切り替え
// ⚠️ 切り替えの中身は今のまま: 既存の OrgSwitcher（localStorage `doya.aishodan.org`・?org=・x-aishodan-org）を使う。
//    ページ本体は組織をページの中で読み込んでいるため、切り替えたあとはページを読み込み直して全部の画面を新しい組織にそろえる。
import OrgSwitcher from '@/components/org/OrgSwitcher'
import { useOrganizationWorkspace } from '@/components/org/OrganizationWorkspaceBoundary'

export default function AishodanShellSwitcher() {
  const workspace = useOrganizationWorkspace()
  if (workspace.scope.kind !== 'ready') return null

  return (
    <OrgSwitcher
      service="aishodan"
      memberships={workspace.scope.memberships}
      currentSlug={workspace.scope.proof.organization.slug}
      onChange={workspace.switchTo}
    />
  )
}
