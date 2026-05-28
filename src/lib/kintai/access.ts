import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { KintaiMemberRole, KintaiContext, ROLE_HIERARCHY } from './types'

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
    where: { userId, status: 'ACTIVE' },
    include: { employee: true },
    orderBy: { createdAt: 'desc' },
  })
  if (!membership || !membership.employee) return null

  return {
    userId,
    organizationId: membership.organizationId,
    role: membership.role as KintaiMemberRole,
    memberId: membership.id,
    employeeId: membership.employee.id,
  }
}

export function hasMinRole(currentRole: string, minRole: KintaiMemberRole): boolean {
  return (ROLE_HIERARCHY[currentRole] ?? 0) >= (ROLE_HIERARCHY[minRole] ?? 0)
}

export async function getOrCreateOrganization(
  userId: string,
  orgName: string,
  employeeName: string,
  email: string
) {
  const existing = await prisma.kintaiMember.findFirst({
    where: { userId, status: 'ACTIVE' },
    include: { organization: true },
  })
  if (existing) return existing.organization

  const slug = orgName.toLowerCase().replace(/[^a-z0-9　-鿿]+/g, '-').replace(/^-|-$/g, '') || `org-${Date.now()}`
  const existingSlug = await prisma.kintaiOrganization.findUnique({ where: { slug } })
  const finalSlug = existingSlug ? `${slug}-${Date.now()}` : slug

  const org = await prisma.kintaiOrganization.create({
    data: {
      name: orgName,
      slug: finalSlug,
    },
  })

  const member = await prisma.kintaiMember.create({
    data: {
      organizationId: org.id,
      userId,
      role: 'system_admin',
      status: 'ACTIVE',
      acceptedAt: new Date(),
    },
  })

  await prisma.kintaiEmployee.create({
    data: {
      organizationId: org.id,
      memberId: member.id,
      name: employeeName,
      email,
      employmentType: 'full_time',
    },
  })

  // Create default work rule
  await prisma.kintaiWorkRule.create({
    data: {
      organizationId: org.id,
      name: '標準（9:00-18:00）',
      workStart: '09:00',
      workEnd: '18:00',
      breakMinutes: 60,
    },
  })

  // Create default departments
  const deptNames = ['営業部', '開発部', '総務部', '人事部']
  for (const name of deptNames) {
    await prisma.kintaiDepartment.create({
      data: { organizationId: org.id, name },
    })
  }

  return org
}
