// ============================================
// 会社のメンバーと権限（/home/roles）
// ============================================
// ⚠️ 旗 COMPANY_ROLES_ROLLOUT が off、または会社に入っていない人には 404。旗を先に見る（off ならセッションも DB も読まない）。
// ⚠️ 最初の表示の中身はサーバーで作って渡す（読み込みの表示を全面に出さない・ちらつかせない）。
// 枠（AppShell）は src/app/(shell)/layout.tsx が出す。
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { companyRolesRollout } from '@/lib/company-roles/rollout'
import { companyRolesSession, listMembersWithRoles } from '@/lib/company-roles/members.server'
import { loadMigrationPlan } from '@/lib/company-roles/migration.server'
import { canCompany } from '@/lib/company-roles/permissions'
import { COMPANY_ROLE_DESCRIPTION, COMPANY_ROLE_LABEL } from '@/lib/company-roles/roles'
import { CompanyRolesManager } from '@/components/company-roles/CompanyRolesManager'

// 404 のとき（旗が off・会社に入っていない）は、タブの題も 404 にする（統括の指摘 2026-10-26）。
// 旗が off のときは、ここでもセッションと DB を読まない。
const NOT_FOUND_TITLE = 'ページが見つかりません'
export async function generateMetadata(): Promise<Metadata> {
  const robots = { index: false, follow: false }
  if (companyRolesRollout() === 'off') return { title: NOT_FOUND_TITLE, robots }
  const session = await getServerSession(authOptions).catch(() => null)
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId) return { title: 'メンバーと権限', robots }
  const s = await companyRolesSession(userId, session?.user?.email ?? null).catch(() => null)
  return { title: s ? 'メンバーと権限' : NOT_FOUND_TITLE, robots }
}

export const dynamic = 'force-dynamic'

export default async function CompanyRolesPage() {
  if (companyRolesRollout() === 'off') notFound()
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId) redirect('/auth/signin?callbackUrl=/home/roles')
  const s = await companyRolesSession(userId, session?.user?.email ?? null)
  if (!s) notFound()
  const can = {
    viewMembers: canCompany(s.role, 'members.view', {}, s.policy),
    changeRoles: canCompany(s.role, 'members.role.change', {}, s.policy),
    viewEvents: canCompany(s.role, 'members.role_events.view', {}, s.policy),
    changePolicy: s.role === 'owner',
  }
  const members = can.viewMembers ? await listMembersWithRoles(s) : []
  // 今までのツールの役割から見た案は、オーナーにだけ見せる（案と今の役割が違う人だけ）
  const plan = s.role === 'owner' ? (await loadMigrationPlan(s.companyId)).filter((r) => r.current !== r.proposed || r.clampedNow.length > 0) : []
  return (
    <CompanyRolesManager
      initial={{
        mode: s.mode,
        me: { role: s.role, label: COMPANY_ROLE_LABEL[s.role], description: COMPANY_ROLE_DESCRIPTION[s.role] },
        can,
        members,
        policy: s.policy,
      }}
      plan={plan}
    />
  )
}
