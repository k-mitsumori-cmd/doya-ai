import { Prisma, type CunningTranscript } from '@prisma/client'
import type { CunningTranscriptCursor } from './history-cursor'

/** Caller holds a repeatable-read snapshot of the owned session and its revision. */
export function readCunningTranscripts(db: Prisma.TransactionClient, userId: string, sessionId: string, take: number, cursor: CunningTranscriptCursor | null = null) {
  const after = cursor ? Prisma.sql`AND (COALESCE(t."audioReceivedAt", t."createdAt"), COALESCE(w.sequence, 2147483647), t."createdAt", t.id) >
    ((${cursor.orderAt}::timestamptz AT TIME ZONE 'UTC'), ${cursor.audioWindowSequence ?? 2147483647}, (${cursor.createdAt}::timestamptz AT TIME ZONE 'UTC'), ${cursor.id})` : Prisma.empty
  return db.$queryRaw<(CunningTranscript & { audioWindowSequence: number | null })[]>(Prisma.sql`
    SELECT t.*, w.sequence AS "audioWindowSequence" FROM cunning_transcripts t JOIN cunning_sessions s ON s.id = t."sessionId"
    LEFT JOIN cunning_audio_windows w ON w."transcriptId" = t.id
    WHERE s.id = ${sessionId} AND s."userId" = ${userId} AND s.status <> 'deleted' ${after}
    ORDER BY COALESCE(t."audioReceivedAt", t."createdAt"), w.sequence ASC NULLS LAST, t."createdAt", t.id LIMIT ${take}`)
}

/** Latest saved audio order for resuming the live screen; return it oldest to newest. */
export async function readRecentCunningTranscripts(db: Prisma.TransactionClient, userId: string, sessionId: string, take: number) {
  const rows = await db.$queryRaw<(CunningTranscript & { audioWindowSequence: number | null })[]>(Prisma.sql`
    SELECT t.*, w.sequence AS "audioWindowSequence" FROM cunning_transcripts t JOIN cunning_sessions s ON s.id = t."sessionId"
    LEFT JOIN cunning_audio_windows w ON w."transcriptId" = t.id
    WHERE s.id = ${sessionId} AND s."userId" = ${userId} AND s.status <> 'deleted'
    ORDER BY COALESCE(t."audioReceivedAt", t."createdAt") DESC, w.sequence DESC NULLS FIRST, t."createdAt" DESC, t.id DESC LIMIT ${take}`)
  return rows.reverse()
}
