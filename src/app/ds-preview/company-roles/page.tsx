// 開発用プレビュー: 会社のメンバーと権限（/home/roles）の見本（ログイン・DB不要）
// ⚠️ 本番では 404。375px / 1280px の画面確認で next start するときだけ DS_PREVIEW=1 で開ける（ds-preview の layout と同じ決まり。本番の環境変数には置かない）。
// ⚠️ 見本のデータだけを出す（DB・API に触れない）。役割を変える操作は、見本では API が 404 を返す。
import { notFound } from 'next/navigation'
import { CompanyRolesManager } from '@/components/company-roles/CompanyRolesManager'
import { RolePickerPreview } from '@/components/company-roles/RolePicker'
import { DEFAULT_ROLE_POLICY } from '@/lib/company-roles/policy'
import { COMPANY_ROLE_DESCRIPTION, COMPANY_ROLE_LABEL, grantableCompanyRoles } from '@/lib/company-roles/roles'

export const dynamic = 'force-dynamic'

export default function CompanyRolesPreviewPage() {
  if (process.env.NODE_ENV === 'production' && process.env.DS_PREVIEW !== '1') notFound()
  const grantable = grantableCompanyRoles('owner')
  return (
    <>
      <CompanyRolesManager
        initial={{
          mode: 'shadow',
          me: { role: 'owner', label: COMPANY_ROLE_LABEL.owner, description: COMPANY_ROLE_DESCRIPTION.owner },
          can: { viewMembers: true, changeRoles: true, viewEvents: false, changePolicy: true },
          policy: DEFAULT_ROLE_POLICY,
          members: [
            { id: null, email: 'owner@example.com', name: '三森 太郎', role: 'owner', status: 'owner', isSelf: true, canChange: false, grantable: [] },
            { id: 'm1', email: 'admin@example.com', name: '佐藤 花子', role: 'admin', status: 'active', isSelf: false, canChange: true, grantable },
            { id: 'm2', email: 'manager@example.com', name: '鈴木 一郎', role: 'manager', status: 'active', isSelf: false, canChange: true, grantable },
            { id: 'm3', email: 'keiri@example.com', name: '高橋 恵', role: 'billing', status: 'active', isSelf: false, canChange: true, grantable },
            { id: 'm4', email: 'staff@example.com', name: '田中 次郎', role: 'member', status: 'active', isSelf: false, canChange: true, grantable },
            { id: 'm5', email: 'partner@example.co.jp', name: null, role: 'guest', status: 'invited', isSelf: false, canChange: true, grantable },
          ],
        }}
        plan={[
          { memberId: 'm4', email: 'staff@example.com', current: 'member', proposed: 'manager', clampedNow: [{ tool: 'kintai', role: 'manager' }], clampedProposed: [] },
        ]}
      />
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '0 16px 64px' }}>
        <RolePickerPreview roles={grantable} legend="招待する人の役割（見本）" />
      </div>
    </>
  )
}
