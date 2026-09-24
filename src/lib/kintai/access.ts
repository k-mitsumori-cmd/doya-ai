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
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const existing = await tx.kintaiMember.findFirst({
          where: { userId, status: 'ACTIVE' },
          include: { organization: true },
        })
        if (existing) return existing.organization

        const base = orgName.toLowerCase().replace(/[^a-z0-9　-鿿]+/g, '-').replace(/^-|-$/g, '') || `org-${Date.now()}`
        const existingSlug = await tx.kintaiOrganization.findUnique({ where: { slug: base } })
        const slug = existingSlug || attempt > 0 ? `${base}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` : base
        const org = await tx.kintaiOrganization.create({ data: { name: orgName, slug } })
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
    } catch (error) {
      const code = (error as { code?: string })?.code
      if (attempt === 2 || (code !== 'P2034' && code !== 'P2002')) throw error
    }
  }
  throw new Error('Organization creation retry exhausted')
}
