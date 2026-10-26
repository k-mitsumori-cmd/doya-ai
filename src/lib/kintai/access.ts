import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { KintaiMemberRole, KintaiContext, ROLE_HIERARCHY } from './types'
import { ceilToolRole } from '@/lib/company-roles/access.server'
import { linkToolOrgAtCreation } from '@/lib/company-roles/tool-orgs.server'

const VALID_MEMBER_ROLES = Object.keys(ROLE_HIERARCHY)

export async function getKintaiContext(): Promise<KintaiContext | null> {
  const session = await getServerSession(authOptions)
  let userId = (session?.user as any)?.id as string | undefined
  if (!userId && session?.user?.email) {
    const dbUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    })
    userId = dbUser?.id
  }
  if (!userId) return null

  const membership = await prisma.kintaiMember.findFirst({
    where: { userId, status: 'ACTIVE', role: { in: VALID_MEMBER_ROLES } },
    include: { employee: true },
    orderBy: { createdAt: 'desc' },
  })
  if (!membership || !membership.employee || !Object.prototype.hasOwnProperty.call(ROLE_HIERARCHY, membership.role)) return null
  // 無効化後も本人の勤怠履歴は読めるが、以前の管理権限は使わせない。
  // 会社の役割の旗の内側では、会社の役割の上限を当てる（会社のメンバーは勤怠の中では一般。ROLES-2026-10-26.md §4）
  const role = await ceilToolRole({ tool: 'kintai', userId, organizationId: membership.organizationId, email: session?.user?.email ?? null, toolRole: membership.employee.isActive ? membership.role : 'employee' })
  if (!role) return null

  return {
    userId,
    organizationId: membership.organizationId,
    role: role as KintaiMemberRole,
    isActive: membership.employee.isActive,
    memberId: membership.id,
    employeeId: membership.employee.id,
  }
}

export function hasMinRole(currentRole: string, minRole: KintaiMemberRole): boolean {
  return Object.prototype.hasOwnProperty.call(ROLE_HIERARCHY, currentRole) && Object.prototype.hasOwnProperty.call(ROLE_HIERARCHY, minRole) && ROLE_HIERARCHY[currentRole] >= ROLE_HIERARCHY[minRole]
}

export async function getOrCreateOrganization(
  userId: string,
  orgName: string,
  employeeName: string,
  email: string
) {
  const createdOrgIds: string[] = []
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      createdOrgIds.length = 0
      const result = await prisma.$transaction(async (tx) => {
        const existing = await tx.kintaiMember.findFirst({
          where: { userId, status: 'ACTIVE', role: { in: VALID_MEMBER_ROLES } },
          include: { organization: true },
        })
        if (existing) return existing.organization
        if (await tx.kintaiMember.findFirst({ where: { userId, status: 'ACTIVE' }, select: { id: true } })) throw Object.assign(new Error('組織の権限を確認できません。管理者に確認してください。'), { code: 'INVALID_MEMBERSHIP_ROLE' })

        const base = orgName.toLowerCase().replace(/[^a-z0-9　-鿿]+/g, '-').replace(/^-|-$/g, '') || `org-${Date.now()}`
        const existingSlug = await tx.kintaiOrganization.findUnique({ where: { slug: base } })
        const slug = existingSlug || attempt > 0 ? `${base}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` : base
        const org = await tx.kintaiOrganization.create({ data: { name: orgName, slug } })
        createdOrgIds.push(org.id)
        const member = await tx.kintaiMember.create({
          data: { organizationId: org.id, userId, role: 'system_admin', status: 'ACTIVE', acceptedAt: new Date() },
        })
        await tx.kintaiEmployee.create({
          data: { organizationId: org.id, memberId: member.id, name: employeeName, email, employmentType: 'full_time' },
        })
        await tx.kintaiWorkRule.create({
          data: { organizationId: org.id, name: '標準（9:00-18:00）', workStart: '09:00', workEnd: '18:00', breakMinutes: 60 },
        })
        for (const name of ['営業部', '開発部', '総務部', '人事部']) {
          await tx.kintaiDepartment.create({ data: { organizationId: org.id, name } })
        }
        return org
      }, { isolationLevel: 'Serializable', maxWait: 10000, timeout: 30000 })
      // 会社の役割の上限は、組織が作られた直後にだけ、会社とのつながりを表へ書く（トランザクションの外）
      if (createdOrgIds[0]) await linkToolOrgAtCreation({ tool: 'kintai', organizationId: createdOrgIds[0], creatorUserId: userId })
      return result
    } catch (error) {
      const code = (error as { code?: string })?.code
      if (attempt === 2 || (code !== 'P2034' && code !== 'P2002')) throw error
    }
  }
  throw new Error('Organization creation retry exhausted')
}
