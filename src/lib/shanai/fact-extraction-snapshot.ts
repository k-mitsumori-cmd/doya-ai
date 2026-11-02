import { createHash } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import type { extractFacts } from './generate'
import type { SurveyAnswers, TranscriptSegmentDto } from './types'
import { lockShanaiStorage } from './storage-purge'

export const FACT_EXTRACTION_CHANGED = '素材や確認内容が変更されたため、抽出結果を保存しませんでした。最新の内容を読み直してから再度お試しください。'
export const FACT_EDIT_CHANGED = '事実が抽出し直されたか、変更されました。最新の内容を読み直してから保存してください。'

/** Serialize fact operations and block concurrent parent updates that do not use the advisory lock. */
export async function lockFactInterview(tx: Prisma.TransactionClient, userId: string, id: string) {
  await lockShanaiStorage(tx, id)
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM shanai_interview WHERE id = ${id} AND "userId" = ${userId} FOR UPDATE
  `
  return rows.length === 1
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]))
  }
  return value
}

function fingerprint(value: unknown) {
  return createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex')
}

/** Read exact generator input and editable fact state while holding the parent lock. */
export async function readFactExtractionSnapshot(tx: Prisma.TransactionClient, userId: string, id: string) {
  const interview = await tx.shanaiInterview.findFirst({
    where: { id, userId },
    include: { facts: { orderBy: { id: 'asc' }, select: {
      id: true, sourceType: true, sourceRef: true, category: true,
      statement: true, quote: true, approved: true, sortOrder: true,
    } } },
  })
  if (!interview) return null
  const company = await tx.shanaiCompany.findUnique({
    where: { userId },
    include: { profileItems: { where: { approved: true }, orderBy: { id: 'asc' },
      select: { id: true, category: true, statement: true, quote: true, sourceId: true } } },
  })
  const input = {
    mode: interview.mode === 'survey' ? 'survey' as const : 'voice' as const,
    intervieweeName: interview.intervieweeName,
    segments: (interview.transcriptSegments as unknown as TranscriptSegmentDto[]) || [],
    answers: (interview.surveyAnswers as unknown as SurveyAnswers) || {},
    companyItems: company?.profileItems || [],
    serviceSourceIds: (interview.serviceSourceIds as unknown as string[]) || [],
  } satisfies Parameters<typeof extractFacts>[0]
  return {
    input, generation: interview.factRuns,
    sourceHash: fingerprint({ input, audioPath: interview.audioPath }),
    factHash: fingerprint(interview.facts),
  }
}
