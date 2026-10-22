import { Prisma } from '@prisma/client'
import { assertLifecycleWritable, lockLifecycleUsers } from '@/lib/account-lifecycle/store'

const MAX_REVISION = 9_223_372_036_854_775_807n
const idPattern = /^[A-Za-z0-9_-]{1,128}$/

export class TenjikaiRevisionError extends Error {
  constructor(readonly status: 400 | 403 | 404 | 409, readonly code: string) {
    super('案件の保存世代を確認できません。')
  }
}

/** Decimal strings are the only client representation of PostgreSQL BIGINT. */
export function parseTenjikaiRevision(value: unknown): bigint {
  if (typeof value !== 'string' || !/^(0|[1-9]\d{0,18})$/.test(value)) throw new TenjikaiRevisionError(400, 'INVALID_REVISION')
  const revision = BigInt(value)
  if (revision > MAX_REVISION) throw new TenjikaiRevisionError(400, 'INVALID_REVISION')
  return revision
}

/** First lock in every project business mutation. Existing generation owner() is the second lock. */
export async function lockTenjikaiActor(tx: Prisma.TransactionClient, actor: string) {
  if (!idPattern.test(actor)) throw new TenjikaiRevisionError(400, 'INVALID_ACTOR')
  await lockLifecycleUsers(tx, [actor])
  await assertLifecycleWritable(tx, [actor])
}

/** When an operation exists, its advisory lock must already be held before this call. */
export async function lockOwnedTenjikaiRevision(tx: Prisma.TransactionClient, actor: string, projectId: string, expected: string) {
  if (!idPattern.test(actor) || !idPattern.test(projectId)) throw new TenjikaiRevisionError(400, 'INVALID_PROJECT')
  const wanted = parseTenjikaiRevision(expected)
  const rows = await tx.$queryRaw<Array<{ revision: bigint }>>`
    SELECT revision FROM tenjikai_project
    WHERE id = ${projectId} AND "userId" = ${actor} FOR UPDATE
  `
  if (rows.length !== 1) throw new TenjikaiRevisionError(404, 'PROJECT_NOT_FOUND')
  if (rows[0].revision !== wanted) throw new TenjikaiRevisionError(409, 'REVISION_CONFLICT')
  if (wanted === MAX_REVISION) throw new TenjikaiRevisionError(409, 'REVISION_EXHAUSTED')
  return wanted
}

/** Call once after every business graph mutation and before the same transaction commits. */
export async function advanceTenjikaiRevision(tx: Prisma.TransactionClient, actor: string, projectId: string, expected: bigint) {
  if (expected < 0n || expected >= MAX_REVISION) throw new TenjikaiRevisionError(409, 'REVISION_EXHAUSTED')
  const rows = await tx.$queryRaw<Array<{ revision: bigint }>>`
    UPDATE tenjikai_project SET revision = revision + 1, "updatedAt" = NOW()
    WHERE id = ${projectId} AND "userId" = ${actor} AND revision = ${expected}
    RETURNING revision
  `
  if (rows.length !== 1 || rows[0].revision !== expected + 1n) throw new TenjikaiRevisionError(409, 'REVISION_CONFLICT')
  return rows[0].revision.toString()
}
