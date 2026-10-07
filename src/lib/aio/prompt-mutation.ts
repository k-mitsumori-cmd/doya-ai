import { createHash } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import type { AioContext } from './types'

export function promptOperationId(value: unknown): string {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new Error('Invalid operation ID')
  return value.toLowerCase()
}

// The prompt row itself retains the creation receipt after archiving. No migration or
// text matching is required, and the same operation cannot create a replacement row.
export function promptIdForOperation(ctx: Pick<AioContext, 'organizationId' | 'userId'>, operationId: string): string {
  return 'ap_' + createHash('sha256').update(JSON.stringify([ctx.organizationId, ctx.userId, operationId])).digest('hex')
}

export async function lockPromptActor(tx: Prisma.TransactionClient, ctx: AioContext) {
  // Member mutations acquire FOR UPDATE on these rows. Hold the actor before the
  // organization lock, so removal/demotion cannot race with a committed prompt write.
  await tx.$queryRaw`SELECT id FROM aio_members WHERE id = ${ctx.memberId} AND "organizationId" = ${ctx.organizationId} FOR SHARE`
  return tx.aioMember.findFirst({
    where: { id: ctx.memberId, organizationId: ctx.organizationId, userId: ctx.userId, status: 'ACTIVE', role: { in: ['owner', 'admin', 'manager'] } },
    select: { id: true, role: true },
  })
}

export function promptBody(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid prompt input')
  return value as Record<string, unknown>
}
