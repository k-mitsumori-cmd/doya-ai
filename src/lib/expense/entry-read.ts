import { prisma } from '@/lib/prisma'
import { EXPENSE_ROLES, type ExpenseRole } from './constants'

export type ExpenseEntryMembership =
  | { state: 'empty' | 'forbidden' }
  | { state: 'found'; slug: string; role: ExpenseRole; organizationId: string; memberId: string }

/** The latest selected membership is authoritative; never fall back past a revoked one. */
export async function readExpenseEntryMembership(userId: string, orgSlug?: string): Promise<ExpenseEntryMembership> {
  if (!userId) return { state: 'forbidden' }
  const member = await prisma.expenseMember.findFirst({
    where: { userId, ...(orgSlug ? { organization: { slug: orgSlug } } : {}) },
    include: { organization: { select: { slug: true } } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  })
  if (!member) return { state: orgSlug ? 'forbidden' : 'empty' }
  if (member.userId !== userId || member.status !== 'ACTIVE' || !(EXPENSE_ROLES as readonly string[]).includes(member.role)) return { state: 'forbidden' }
  return { state: 'found', slug: member.organization.slug, role: member.role as ExpenseRole, organizationId: member.organizationId, memberId: member.id }
}
