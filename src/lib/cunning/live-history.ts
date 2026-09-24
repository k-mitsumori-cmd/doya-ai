type StoredTranscript = { id?: unknown; text?: unknown; speaker?: unknown }
type StoredAnswer = {
  id?: unknown; questionText?: unknown; summary?: unknown; script?: unknown
  sources?: unknown; model?: unknown; finalTranscriptId?: unknown
}

export function restoreCunningLiveHistory(session: {
  transcripts?: unknown; answers?: unknown; totals?: { transcripts?: unknown; answers?: unknown }
}) {
  if (!Array.isArray(session.transcripts) || !Array.isArray(session.answers)) {
    throw new Error('保存済みの履歴を確認できません')
  }
  const transcripts = (session.transcripts as StoredTranscript[]).filter((row) =>
    typeof row.id === 'string' && typeof row.text === 'string' &&
    (row.speaker === 'remote' || row.speaker === 'self'))
  const answers = (session.answers as StoredAnswer[]).filter((row) =>
    typeof row.id === 'string' && typeof row.questionText === 'string' &&
    typeof row.summary === 'string' && typeof row.script === 'string')
  return {
    lines: transcripts.slice(-81).map(row => ({
      id: row.id as string, text: row.text as string, speaker: row.speaker as 'remote' | 'self',
    })),
    answers: answers.slice(-200).reverse().map(row => ({
      id: row.id as string, question: row.questionText as string,
      summary: row.summary as string, script: row.script as string,
      sources: Array.isArray(row.sources) ? row.sources.filter((source): source is { label: string; url?: string } =>
        !!source && typeof source === 'object' && typeof source.label === 'string' &&
        (source.url === undefined || typeof source.url === 'string')) : [],
      model: typeof row.model === 'string' ? row.model : undefined,
      finalTranscriptId: typeof row.finalTranscriptId === 'string' ? row.finalTranscriptId : undefined,
      loading: false,
    })),
    hasMore: (typeof session.totals?.transcripts === 'number' && session.totals.transcripts > session.transcripts.length) ||
      (typeof session.totals?.answers === 'number' && session.totals.answers > session.answers.length),
  }
}
