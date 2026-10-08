import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { HrMemberRole, HrContext } from './types'
import { ROLE_HIERARCHY } from './constants'

const VALID_MEMBER_ROLES = Object.keys(ROLE_HIERARCHY)

export async function getHrContext(): Promise<HrContext | null> {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as any)?.id as string | undefined
  if (!userId) return null

  const membership = await prisma.hrOrganizationMember.findFirst({
    where: { userId, status: 'ACTIVE', role: { in: VALID_MEMBER_ROLES } },
    orderBy: { createdAt: 'desc' },
  })
  if (!membership || !Object.prototype.hasOwnProperty.call(ROLE_HIERARCHY, membership.role)) return null

  return {
    userId,
    organizationId: membership.organizationId,
    role: membership.role as HrMemberRole,
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
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const existing = await tx.hrOrganizationMember.findFirst({
          where: { userId, status: 'ACTIVE', role: { in: VALID_MEMBER_ROLES } }, include: { organization: true },
        })
        if (existing) return existing.organization
        if (await tx.hrOrganizationMember.findFirst({ where: { userId, status: 'ACTIVE' }, select: { id: true } })) throw Object.assign(new Error('組織の権限を確認できません。管理者に確認してください。'), { code: 'INVALID_MEMBERSHIP_ROLE' })

        const base = options?.slug || orgName.toLowerCase().replace(/[^a-z0-9　-鿿]+/g, '-').replace(/^-|-$/g, '') || `org-${Date.now()}`
        const existingSlug = await tx.hrOrganization.findUnique({ where: { slug: base } })
        const slug = existingSlug || attempt > 0 ? `${base}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` : base
        return tx.hrOrganization.create({
          data: {
            name: orgName, slug, industry: options?.industry || null, size: options?.size || null,
            members: { create: { userId, role: HrMemberRole.OWNER, status: 'ACTIVE', acceptedAt: new Date() } },
          },
        })
      }, { isolationLevel: 'Serializable', maxWait: 10000, timeout: 30000 })
    } catch (error) {
      const code = (error as { code?: string })?.code
      if (attempt === 2 || (code !== 'P2034' && code !== 'P2002')) throw error
    }
  }
  throw new Error('Organization creation retry exhausted')
}
