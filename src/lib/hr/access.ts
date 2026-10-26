import { getServerSession } from 'next-auth'
import { headers } from 'next/headers'
import { parseHrOrganizationSelection } from './organization-selection'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { HrMemberRole, HrContext } from './types'
import { ROLE_HIERARCHY } from './constants'
import { ceilToolRole } from '@/lib/company-roles/access.server'
import { linkToolOrgAtCreation } from '@/lib/company-roles/tool-orgs.server'

const VALID_MEMBER_ROLES = Object.keys(ROLE_HIERARCHY)

export async function getHrContext(): Promise<HrContext | null> {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as any)?.id as string | undefined
  if (!userId) return null

  const selection = parseHrOrganizationSelection(await headers(), userId)
  // An explicit invalid/revoked selection must never fall back to another organization.
  if (selection.kind === 'invalid') return null
  const membership = await prisma.hrOrganizationMember.findFirst({
    where: { userId, status: 'ACTIVE', role: { in: VALID_MEMBER_ROLES },
      ...(selection.kind === 'selected' ? { organizationId: selection.organizationId } : {}) },
    orderBy: { createdAt: 'desc' },
  })
  if (!membership || !Object.prototype.hasOwnProperty.call(ROLE_HIERARCHY, membership.role)) return null
  // 会社の役割の旗の内側では、会社の役割の上限を当てる（ROLES-2026-10-26.md §4）
  const role = await ceilToolRole({ tool: 'hr', userId, organizationId: membership.organizationId, email: session?.user?.email ?? null, toolRole: membership.role })
  if (!role) return null

  return {
    userId,
    organizationId: membership.organizationId,
    role: role as HrMemberRole,
    memberId: membership.id,
    employeeId: membership.employeeId,
  }
}

export function requireRole(
  currentRole: string,
  requiredRoles: HrMemberRole[]
): boolean {
  return requiredRoles.includes(currentRole as HrMemberRole)
}

export function hasMinRole(currentRole: string, minRole: HrMemberRole): boolean {
  return Object.prototype.hasOwnProperty.call(ROLE_HIERARCHY, currentRole) && Object.prototype.hasOwnProperty.call(ROLE_HIERARCHY, minRole) && ROLE_HIERARCHY[currentRole] >= ROLE_HIERARCHY[minRole]
}

export async function getOrCreateOrganization(
  userId: string,
  orgName: string,
  options?: { slug?: string; industry?: string; size?: string }
) {
  const createdOrgIds: string[] = []
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      createdOrgIds.length = 0
      const result = await prisma.$transaction(async (tx) => {
        const existing = await tx.hrOrganizationMember.findFirst({
          where: { userId, status: 'ACTIVE', role: { in: VALID_MEMBER_ROLES } }, include: { organization: true },
        })
        if (existing) return existing.organization
        if (await tx.hrOrganizationMember.findFirst({ where: { userId, status: 'ACTIVE' }, select: { id: true } })) throw Object.assign(new Error('組織の権限を確認できません。管理者に確認してください。'), { code: 'INVALID_MEMBERSHIP_ROLE' })

        const base = options?.slug || orgName.toLowerCase().replace(/[^a-z0-9　-鿿]+/g, '-').replace(/^-|-$/g, '') || `org-${Date.now()}`
        const existingSlug = await tx.hrOrganization.findUnique({ where: { slug: base } })
        const slug = existingSlug || attempt > 0 ? `${base}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` : base
        const created = await tx.hrOrganization.create({
          data: {
            name: orgName, slug, industry: options?.industry || null, size: options?.size || null,
            members: { create: { userId, role: HrMemberRole.OWNER, status: 'ACTIVE', acceptedAt: new Date() } },
          },
        })
        createdOrgIds.push(created.id)
        return created
      }, { isolationLevel: 'Serializable', maxWait: 10000, timeout: 30000 })
      // 会社の役割の上限は、組織が作られた直後にだけ、会社とのつながりを表へ書く（トランザクションの外）
      if (createdOrgIds[0]) await linkToolOrgAtCreation({ tool: 'hr', organizationId: createdOrgIds[0], creatorUserId: userId })
      return result
    } catch (error) {
      const code = (error as { code?: string })?.code
      if (attempt === 2 || (code !== 'P2034' && code !== 'P2002')) throw error
    }
  }
  throw new Error('Organization creation retry exhausted')
}
