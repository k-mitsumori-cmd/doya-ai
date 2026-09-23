import type { Prisma } from '@prisma/client'

export type CunningReportStatus = 'current' | 'outdated' | 'unverified'

/** Hash exactly the report inputs in PostgreSQL; do not transfer full transcripts for a status check. */
export async function cunningReportFingerprint(
  db: Pick<Prisma.TransactionClient, '$queryRaw'>,
  userId: string, sessionId: string, revision: Date,
): Promise<string | null> {
  const rows = await db.$queryRaw<{ fingerprint: string }[]>`
    SELECT encode(sha256(convert_to(jsonb_build_object(
      'mode', s.mode, 'personaNote', s."personaNote",
      'transcripts', (SELECT jsonb_agg(jsonb_build_array(t.text, t.speaker) ORDER BY COALESCE(t."audioReceivedAt", t."createdAt"), w.sequence ASC NULLS LAST, t."createdAt", t.id)
        FROM cunning_transcripts t LEFT JOIN cunning_audio_windows w ON w."transcriptId" = t.id WHERE t."sessionId" = s.id),
      'answers', (SELECT jsonb_agg(jsonb_build_array(a."questionText", a.summary, a.script) ORDER BY a."createdAt", a.id)
        FROM cunning_answers a WHERE a."sessionId" = s.id)
    )::text, 'UTF8')), 'hex') AS fingerprint
    FROM cunning_sessions s
    WHERE s.id = ${sessionId} AND s."userId" = ${userId}
      AND s.status <> 'deleted' AND s."updatedAt" = (${revision}::timestamptz AT TIME ZONE 'UTC')`
  return rows[0]?.fingerprint ?? null
}

export function cunningReportStatus(report: unknown, fingerprint: string | null): CunningReportStatus {
  const stored = report && typeof report === 'object' && 'sourceFingerprint' in report
    ? report.sourceFingerprint : null
  if (typeof stored !== 'string' || !stored || !fingerprint) return 'unverified'
  return stored === fingerprint ? 'current' : 'outdated'
}
