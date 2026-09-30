import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

type PlanReader = Pick<Prisma.TransactionClient, 'shodanMember' | 'user'>

/** 組織共通の利用枠は、操作メンバーではなく組織オーナーの契約で判定する。 */
export async function getShodanOrganizationPlan(
  organizationId: string,
  db: PlanReader = prisma,
): Promise<string> {
  const owner = await db.shodanMember.findFirst({
    where: { organizationId, role: 'owner', status: 'ACTIVE', userId: { not: null } },
    orderBy: { createdAt: 'asc' },
    select: { userId: true },
  })
  if (!owner?.userId) return 'FREE'
  const user = await db.user.findUnique({
    where: { id: owner.userId },
    select: { plan: true },
  })
  return user?.plan || 'FREE'
}
