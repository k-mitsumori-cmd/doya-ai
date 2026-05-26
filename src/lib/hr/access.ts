import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { HrMemberRole, HrContext } from './types'
import { ROLE_HIERARCHY } from './constants'

export async function getHrContext(): Promise<HrContext | null> {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as any)?.id as string | undefined
  if (!userId) return null

  const membership = await prisma.hrOrganizationMember.findFirst({
    where: { userId, status: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
  })
  if (!membership) return null

  return {
    userId,
    organizationId: membership.organizationId,
    role: membership.role as HrMemberRole,
    memberId: membership.id,
  }
}

export function requireRole(
  currentRole: string,
  requiredRoles: HrMemberRole[]
): boolean {
  return requiredRoles.includes(currentRole as HrMemberRole)
}

export function hasMinRole(currentRole: string, minRole: HrMemberRole): boolean {
  return (ROLE_HIERARCHY[currentRole] ?? 0) >= (ROLE_HIERARCHY[minRole] ?? 0)
}

export async function getOrCreateOrganization(
  userId: string,
  orgName: string,
  options?: { slug?: string; industry?: string; size?: string }
) {
  const existing = await prisma.hrOrganizationMember.findFirst({
    where: { userId, status: 'ACTIVE' },
    include: { organization: true },
  })
  if (existing) return existing.organization

  const slug =
    options?.slug ||
    orgName
      .toLowerCase()
      .replace(/[^a-z0-9　-鿿]+/g, '-')
      .replace(/^-|-$/g, '') ||
    `org-${Date.now()}`

  const existingSlug = await prisma.hrOrganization.findUnique({
    where: { slug },
  })
  const finalSlug = existingSlug ? `${slug}-${Date.now()}` : slug

  const org = await prisma.hrOrganization.create({
    data: {
      name: orgName,
      slug: finalSlug,
      industry: options?.industry || null,
      size: options?.size || null,
      members: {
        create: {
          userId,
          role: HrMemberRole.OWNER,
          status: 'ACTIVE',
          acceptedAt: new Date(),
        },
      },
    },
  })

  return org
}
