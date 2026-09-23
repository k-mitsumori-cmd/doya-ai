import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

type Owner = { userId: string | null; guestId: string | null }
export type SeoJobExecution = Owner & { jobId: string; articleId: string; token: string }
export class SeoExecutionLostError extends Error {
  constructor() { super('SEO job execution is no longer current'); this.name = 'SeoExecutionLostError' }
}

async function lockArticle(tx: Prisma.TransactionClient, articleId: string, owner: Owner) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "SeoArticle" WHERE "id" = ${articleId}
    AND "userId" IS NOT DISTINCT FROM ${owner.userId}
    AND "guestId" IS NOT DISTINCT FROM ${owner.guestId} FOR UPDATE`
  if (rows.length !== 1) throw new SeoExecutionLostError()
}

/** Short transactions only; never hold these locks while calling an AI provider. */
export async function acquireSeoJobExecution(jobId: string, articleId: string, owner: Owner, ttlMs = 360000): Promise<SeoJobExecution | null> {
  if (!Number.isSafeInteger(ttlMs) || ttlMs < 1000 || ttlMs > 900000) throw new Error('Invalid execution TTL')
  const token = randomUUID()
  return prisma.$transaction(async tx => {
    await lockArticle(tx, articleId, owner)
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      UPDATE "SeoJob" SET "executionToken" = ${token},
        "executionExpiresAt" = (clock_timestamp() AT TIME ZONE 'UTC') + (${ttlMs} * interval '1 millisecond')
      WHERE "id" = ${jobId} AND "articleId" = ${articleId} AND "status" IN ('queued', 'running') AND "supersededAt" IS NULL
        AND ("executionToken" IS NULL OR "executionExpiresAt" <= (clock_timestamp() AT TIME ZONE 'UTC'))
        AND NOT EXISTS (
          SELECT 1 FROM "SeoJob" AS other
          WHERE other."articleId" = ${articleId} AND other."id" <> ${jobId}
            AND other."executionToken" IS NOT NULL AND other."executionExpiresAt" > (clock_timestamp() AT TIME ZONE 'UTC')
            AND other."status" IN ('queued', 'running')
        )
      RETURNING "id"`
    return rows.length === 1 ? { jobId, articleId, token, ...owner } : null
  })
}

export async function withSeoJobExecution<T>(execution: SeoJobExecution, write: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(async tx => {
    await lockArticle(tx, execution.articleId, execution)
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "SeoJob" WHERE "id" = ${execution.jobId} AND "articleId" = ${execution.articleId}
        AND "executionToken" = ${execution.token} AND "status" IN ('queued', 'running') AND "supersededAt" IS NULL FOR UPDATE`
    if (rows.length !== 1) throw new SeoExecutionLostError()
    const live = await tx.$queryRaw<Array<{ valid: boolean }>>`
      SELECT "executionExpiresAt" > (clock_timestamp() AT TIME ZONE 'UTC') AS valid FROM "SeoJob" WHERE "id" = ${execution.jobId}`
    if (live[0]?.valid !== true) throw new SeoExecutionLostError()
    return write(tx)
  })
}

export async function releaseSeoJobExecution(execution: SeoJobExecution): Promise<void> {
  await prisma.seoJob.updateMany({
    where: { id: execution.jobId, executionToken: execution.token },
    data: { executionToken: null, executionExpiresAt: null },
  })
}
