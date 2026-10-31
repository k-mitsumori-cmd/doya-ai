// POST /api/shanai/interviews/[id]/transcribe — 録音の文字起こし（AssemblyAI）
// 1回の呼び出しで最大4分待つ。終わらなければ { pending: true } を返すので、画面から同じAPIを呼び直す
// （2回目以降は送信済みのジョブの完了を待つだけで、新たな課金は発生しない）。
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getShanaiUserId, json, notFound, ownInterview, quotaExceeded, reserveTranscript, unauthorized } from '@/lib/shanai/access'
import { interviewDetailDto } from '@/lib/shanai/dto'
import { MAX_AUDIO_SECONDS } from '@/lib/shanai/storage'
import { isCuid } from '@/lib/shanai/types'
import { transcribeExistingJob, transcribeFromUrl, InterviewTranscriptionTerminalError } from '@/lib/interview/transcription'
import { inspectInterviewMediaDuration } from '@/lib/interview/media-duration'
import { recordServiceUsage } from '@/lib/service-usage'
import { authorizeTranscriptSubmission, rememberTranscriptJob, completeTranscriptAttempt, failTranscriptAttempt, RECORDING_CHANGED, SUBMISSION_UNCERTAIN, ShanaiRecordingChangedError, type TranscriptContext } from '@/lib/shanai/transcription-attempt'

type Ctx = { params: Promise<{ id: string }> }

const WAIT_MS = 4 * 60 * 1000

export async function POST(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  const userId = await getShanaiUserId()
  if (!userId) return unauthorized()
  if (!isCuid(id)) return notFound()
  let context: TranscriptContext | undefined
  try {
    const interview = await prisma.shanaiInterview.findFirst({ where: ownInterview(userId, id) })
    if (!interview) return notFound()
    if (interview.mode !== 'voice') return json({ error: 'このインタビューはアンケートで作成しています。' }, 400)
    if (!interview.audioPath || !interview.audioSize || !interview.audioMime) return json({ error: '先に録音ファイルをアップロードしてください。' }, 400)
    if (interview.transcriptStatus === 'done') return json({ success: true, interview: await interviewDetailDto(id, userId) })

    // 完了待ち・準備中・送信結果不明の処理は、長さの再計測や新規送信をしない。
    let reserved = await reserveTranscript(userId, id, { audioPath: interview.audioPath, durationSec: null })
    if (!reserved.ok && reserved.needsDuration) {
      let seconds: number
      try { seconds = await inspectInterviewMediaDuration(interview.audioPath, interview.audioSize) }
      catch { return json({ error: '録音の長さを確認できませんでした。mp3・m4a・wav などの形式で保存し直してお試しください。' }, 422) }
      if (seconds > MAX_AUDIO_SECONDS) return json({ error: `録音は${MAX_AUDIO_SECONDS / 60}分までです。長い場合は分けて別のインタビューにしてください。` }, 400)
      reserved = await reserveTranscript(userId, id, { audioPath: interview.audioPath, durationSec: seconds })
    }
    if (!reserved.ok) {
      if (reserved.pending) return json({ success: true, pending: true })
      if (reserved.quota) return quotaExceeded(reserved.quota)
      return json({ error: reserved.reason || '文字起こしを開始できません。', ...(reserved.uncertain ? { code: 'TRANSCRIPT_SUBMISSION_UNCERTAIN' } : {}) }, reserved.uncertain || reserved.changed ? 409 : 400)
    }
    if (reserved.action === 'done') return json({ success: true, interview: await interviewDetailDto(id, userId) })
    const owned = reserved.context
    context = owned
    let jobId = reserved.jobId
    const result = reserved.action === 'poll'
      ? await transcribeExistingJob(jobId!, WAIT_MS)
      : await transcribeFromUrl({
        storagePath: interview.audioPath, mimeType: interview.audioMime, fileSize: interview.audioSize,
        language: 'ja', maxWaitMs: WAIT_MS,
        onBeforeSubmit: () => authorizeTranscriptSubmission(owned),
        onJobSubmitted: async received => { await rememberTranscriptJob(owned, received); jobId = received },
      })
    const segments = result.segments.map(s => ({ start: s.start, end: s.end, speaker: s.speaker, text: s.text }))
    const completed = await completeTranscriptAttempt(owned, jobId, segments)
    if (completed === 'stale') return json({ error: RECORDING_CHANGED }, 409)
    if (reserved.action === 'submit') {
      void recordServiceUsage({ userId, serviceId: 'shanai', action: '録音を文字起こし', summary: `${Math.ceil(owned.durationSec / 60)}分`, metadata: { seconds: owned.durationSec } })
    }
    return json({ success: true, interview: await interviewDetailDto(id, userId) })
  } catch (e) {
    if (e instanceof ShanaiRecordingChangedError) return json({ error: RECORDING_CHANGED }, 409)
    const terminal = e instanceof InterviewTranscriptionTerminalError
    console.error('[shanai/transcribe] failed', (e as Error)?.name)
    const message = terminal ? (e as Error).message : '文字起こしに失敗しました。時間をおいてもう一度お試しください。'
    if (context) {
      // DBが一時的に使えなくても、POST許可済みの記録は消さず、次回の二重送信を防ぐ。
      const outcome = await failTranscriptAttempt(context, terminal, message).catch(() => 'uncertain' as const)
      if (outcome === 'stale') return json({ error: RECORDING_CHANGED }, 409)
      if (outcome === 'pending') return json({ success: true, pending: true })
      if (outcome === 'uncertain') return json({ error: SUBMISSION_UNCERTAIN, code: 'TRANSCRIPT_SUBMISSION_UNCERTAIN' }, 409)
    }
    return json({ error: message }, terminal ? 422 : 500)
  }
}
