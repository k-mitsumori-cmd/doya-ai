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

type Ctx = { params: Promise<{ id: string }> }

const WAIT_MS = 4 * 60 * 1000

async function saveResult(id: string, result: Awaited<ReturnType<typeof transcribeExistingJob>>) {
  const segments = result.segments.map((s) => ({ start: s.start, end: s.end, speaker: s.speaker, text: s.text }))
  await prisma.shanaiInterview.update({
    where: { id },
    data: { transcriptStatus: 'done', transcriptSegments: segments, transcriptError: null, status: 'FACTS' },
  })
}

function isTimeout(e: unknown) {
  return e instanceof Error && e.message.includes('タイムアウト')
}

export async function POST(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params
  const userId = await getShanaiUserId()
  if (!userId) return unauthorized()
  if (!isCuid(id)) return notFound()

  const interview = await prisma.shanaiInterview.findFirst({ where: ownInterview(userId, id) })
  if (!interview) return notFound()
  if (interview.mode !== 'voice') return json({ error: 'このインタビューはアンケートで作成しています。' }, 400)
  if (!interview.audioPath || !interview.audioSize || !interview.audioMime) return json({ error: '先に録音ファイルをアップロードしてください。' }, 400)
  if (interview.transcriptStatus === 'done') return json({ success: true, interview: await interviewDetailDto(id, userId) })

  try {
    // 送信済みのジョブがあれば、その完了を待つだけ（二重に課金しない）
    if (interview.transcriptStatus === 'processing' && interview.transcriptJobId) {
      const result = await transcribeExistingJob(interview.transcriptJobId, WAIT_MS)
      await saveResult(id, result)
      return json({ success: true, interview: await interviewDetailDto(id, userId) })
    }

    // ⚠️ 長さは保存された中身から測る（ブラウザの申告を信用しない）。長い録音ほど費用がかかる
    let seconds: number
    try {
      seconds = await inspectInterviewMediaDuration(interview.audioPath, interview.audioSize)
    } catch {
      return json({ error: '録音の長さを確認できませんでした。mp3・m4a・wav などの形式で保存し直してお試しください。' }, 422)
    }
    if (seconds > MAX_AUDIO_SECONDS) return json({ error: `録音は${MAX_AUDIO_SECONDS / 60}分までです。長い場合は分けて別のインタビューにしてください。` }, 400)

    const reserved = await reserveTranscript(userId, id)
    if (!reserved.ok) return reserved.quota ? quotaExceeded(reserved.quota) : json({ error: reserved.reason }, 400)
    await prisma.shanaiInterview.update({ where: { id }, data: { audioDurationSec: seconds } })

    const result = await transcribeFromUrl({
      storagePath: interview.audioPath,
      mimeType: interview.audioMime,
      fileSize: interview.audioSize,
      language: 'ja',
      maxWaitMs: WAIT_MS,
      onJobSubmitted: async (jobId) => {
        await prisma.shanaiInterview.update({ where: { id }, data: { transcriptJobId: jobId } })
      },
    })
    await saveResult(id, result)
    void recordServiceUsage({ userId, serviceId: 'shanai', action: '録音を文字起こし', summary: `${Math.ceil(seconds / 60)}分`, metadata: { seconds } })
    return json({ success: true, interview: await interviewDetailDto(id, userId) })
  } catch (e) {
    if (isTimeout(e)) return json({ success: true, pending: true })
    const terminal = e instanceof InterviewTranscriptionTerminalError
    console.error('[shanai/transcribe] failed', (e as Error)?.name)
    const message = terminal ? (e as Error).message : '文字起こしに失敗しました。時間をおいてもう一度お試しください。'
    // ⚠️ 送信済みのジョブがある一時的な失敗（通信エラー等）は processing のまま残す。
    //    次の呼び出しでそのジョブの完了を待つだけにし、同じ録音を二重に送らない
    const current = await prisma.shanaiInterview.findUnique({ where: { id }, select: { transcriptJobId: true } }).catch(() => null)
    if (!terminal && current?.transcriptJobId) return json({ success: true, pending: true })
    await prisma.shanaiInterview.update({ where: { id }, data: { transcriptStatus: 'failed', transcriptError: message, transcriptJobId: null } }).catch(() => {})
    return json({ error: message }, terminal ? 422 : 500)
  }
}
