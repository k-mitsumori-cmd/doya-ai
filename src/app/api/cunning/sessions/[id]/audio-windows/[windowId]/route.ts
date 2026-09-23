import { createHash } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/cunning/access'
import { claimCunningAudioWindow, settleCunningAudioWindow, releaseCunningAudioWindow } from '@/lib/cunning/audio-windows'
import { transcribeChunk } from '@/lib/cunning/transcribe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300
const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' }
type Claim = { userId: string; sessionId: string; recordingToken: string; windowId: string; inputHash: string; claimToken: string }

export async function POST(request: Request, context: { params: Promise<{ id: string; windowId: string }> }) {
  let claim: Claim | undefined
  try {
    const userId = await getUserId()
    if (!userId) return Response.json({ error: 'ログインが必要です' }, { status: 401, headers })
    let form: FormData
    try { form = await request.formData() } catch { return Response.json({ error: '音声データを読み取れませんでした' }, { status: 400, headers }) }
    const recordingToken = form.get('recordingToken'), language = form.get('language') ?? 'ja'
    const audio = form.get('audio'), silent = form.get('silent') === '1'
    if (typeof recordingToken !== 'string' || !recordingToken || recordingToken.length > 128 || !['ja', 'en', 'auto'].includes(language as string) ||
        (form.has('silent') && !silent) || (silent ? audio !== null : !(audio instanceof Blob) || audio.size === 0)) {
      return Response.json({ error: '音声または録音識別子が不正です' }, { status: 400, headers })
    }
    if (audio instanceof Blob && audio.size > 4 * 1024 * 1024) return Response.json({ error: '音声データが大きすぎます' }, { status: 413, headers })
    const { id: sessionId, windowId } = await context.params
    const inputHash = createHash('sha256').update(`${silent ? 'silent' : 'audio'}\0${language}\0`)
      .update(audio instanceof Blob ? new Uint8Array(await audio.arrayBuffer()) : new Uint8Array()).digest('hex')
    const input = { userId, sessionId, windowId, recordingToken, inputHash }
    const admission = await claimCunningAudioWindow(prisma, input)
    if (admission.state === 'cached') return Response.json({ text: admission.transcript.text, transcriptId: admission.transcript.id }, { headers })
    if (admission.state !== 'claimed') return Response.json({ error: 'この音声は処理中か、受付期限または再試行回数の上限に達しています。', code: admission.state }, { status: admission.state === 'missing' ? 404 : 409, headers })
    claim = { ...input, claimToken: admission.claimToken }
    const text = silent ? '' : (await transcribeChunk(audio as Blob, { filename: 'chunk.webm', language: language as string })).text
    const saved = await settleCunningAudioWindow(prisma, { ...claim, text })
    if (saved.state !== 'saved' && saved.state !== 'cached') return Response.json({ error: '音声を保存できませんでした。再試行の結果を確認してください。', code: saved.state }, { status: saved.state === 'missing' ? 404 : 409, headers })
    return Response.json({ text: saved.transcript.text, transcriptId: saved.transcript.id }, { headers })
  } catch {
    if (claim) {
      try { await releaseCunningAudioWindow(prisma, claim) } catch { /* The claim remains recoverable after its lease expires. */ }
    }
    return Response.json({ error: '音声を保存できませんでした。同じ音声で再試行してください。' }, { status: 503, headers })
  }
}
