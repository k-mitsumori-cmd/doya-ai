import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'
import { ceilToolRole } from '@/lib/company-roles/access.server'
import { TOOL_ROLE_TABLES, type ToolId } from '@/lib/company-roles/tool-roles'
import { withToolSeatAdmission, ToolSeatAdmissionError, toolSeatAdmissionFailure } from './tool-seat-admission.server'

export class ToolSeatInvitationDomainError extends Error {
  constructor(readonly kind: 'missing' | 'forbidden') { super(kind) }
}
export function toolSeatInvitationFailure(error: unknown) {
  if (error instanceof ToolSeatInvitationDomainError) return { status: error.kind === 'missing' ? 404 : 403, body: { error: error.kind === 'missing' ? '組織が見つかりません' : '招待権限が変更されました。再読み込みしてください' } }
  return toolSeatAdmissionFailure(error)
}

/** Reserve only through the shared SQL admission guard. Recipient IDs are
 * lock hints; re-read the current email identity under those principal locks.
 * Current company ceiling precedes domain organization locks. Callers retain
 * their own current actor/rank/duplicate/expiry and service-limit checks.
 * No email, provider, profile, central enrollment or purchase occurs here. */
export async function withToolSeatInvitation<T, Domain>(
  input: { tool: ToolId; organizationId: string; actorUserId: string; email: string },
  authorizeDomain: (tx: Prisma.TransactionClient, ceiling: string | null) => Promise<{ role: string; value: Domain }>,
  work: (tx: Prisma.TransactionClient, domain: Domain) => Promise<T>,
) {
  const email = input.email.trim().toLowerCase()
  if (!email || email.length > 254) throw new ToolSeatAdmissionError(403, 'INVALID_TOOL_MEMBERSHIP', 'contact-owner')
  const recipients = await prisma.user.findMany({ where: { email: { equals: email, mode: 'insensitive' } }, select: { id: true }, take: 2 })
  if (recipients.length > 1) throw new ToolSeatAdmissionError(503, 'SEAT_CAPACITY_UNAVAILABLE', 'retry')
  return withToolSeatAdmission({ tool: input.tool, organizationId: input.organizationId, actorUserId: input.actorUserId, additionalUserIds: recipients.map(user => user.id) }, async tx => {
    const ceiling = await ceilToolRole({ tool: input.tool, organizationId: input.organizationId, userId: input.actorUserId, toolRole: TOOL_ROLE_TABLES[input.tool].order[TOOL_ROLE_TABLES[input.tool].order.length - 1] }, tx)
    return authorizeDomain(tx, ceiling)
  }, async (tx, domain) => {
    const current = await tx.user.findMany({ where: { email: { equals: email, mode: 'insensitive' } }, select: { id: true }, take: 2 })
    if (current.length !== recipients.length || current.some(user => !recipients.some(hint => hint.id === user.id))) throw new ToolSeatAdmissionError(409, 'SEAT_CONTEXT_CHANGED', 'retry')
    return work(tx, domain)
  })
}
