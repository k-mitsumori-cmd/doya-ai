import { createHash } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { HrEvaluationInputError, readHrEvaluationExpectedVersion } from '@/lib/hr/evaluation-input'

export function readHrEvaluationPeriodDeletionInput(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HrEvaluationInputError('削除前に評価期間を再取得してください。')
  const row = value as Record<string, unknown>
  if (Object.keys(row).sort().join(',') !== 'expectedDeletionRevision,expectedUpdatedAt' ||
    typeof row.expectedDeletionRevision !== 'string' || !/^[a-f0-9]{64}$/.test(row.expectedDeletionRevision)) throw new HrEvaluationInputError('削除前に評価期間を再取得してください。')
  return { expectedUpdatedAt: readHrEvaluationExpectedVersion(row.expectedUpdatedAt), expectedDeletionRevision: row.expectedDeletionRevision }
}

/** Covers child inserts, deletes and edits, including SQL edits that do not update updatedAt. */
export async function getHrEvaluationPeriodDeletionRevision(db: Pick<Prisma.TransactionClient, '$queryRaw'>, organizationId: string, periodId: string) {
  const rows = await db.$queryRaw<{ version: string | null; evaluations: string }[]>`
    SELECT
      (SELECT xmin::text FROM hr_evaluation_periods WHERE id = ${periodId} AND "organizationId" = ${organizationId}) AS version,
      (SELECT md5(COALESCE(string_agg(id || ':' || xmin::text, ',' ORDER BY id), '')) FROM hr_evaluations WHERE "periodId" = ${periodId}) AS evaluations
  `
  const row = rows[0]
  if (!row?.version) throw new HrEvaluationInputError('削除前に評価期間を再取得してください。')
  return createHash('sha256').update(JSON.stringify([organizationId, periodId, row.version, row.evaluations])).digest('hex')
}
