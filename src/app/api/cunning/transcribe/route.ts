export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/cunning/access'
import { canStartSession } from '@/lib/cunning/limits'
import { writeCunningSession } from '@/lib/cunning/session-write'
import { transcribeChunk } from '@/lib/cunning/transcribe'
import { admitCunningAudio, releaseFailedCunningAudio, hasCurrentCunningAudioClaim } from '@/lib/cunning/audio-admission'

// POST /api/cunning/transcribe — 音声チャンク(multipart) → 文字起こしテキスト
// body: FormData { audio: Blob, sessionId: string }
export async function POST(req: NextRequest) {
  let claim: { userId: string; sessionId: string; token: string; speaker: 'remote' | 'self'; claimedAt: Date } | undefined
  try {
    const userId = await getUserId()
    if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })

    const form = await req.formData()
    const audio = form.get('audio')
    const rawSessionId = form.get('sessionId')
    const sessionId = typeof rawSessionId === 'string' ? rawSessionId.trim() : ''
    if (!sessionId) return NextResponse.json({ error: '文字起こしにはセッションが必要です' }, { status: 400 })
    const speaker = (form.get('speaker') as string) === 'self' ? 'self' : 'remote'
    // 言語: ja(既定) / en / auto。auto は自動判定（ヒントなし）。
    const langRaw = (form.get('language') as string) || 'ja'
    const language = langRaw === 'en' ? 'en' : langRaw === 'auto' ? 'auto' : 'ja'
    if (!(audio instanceof Blob) || audio.size === 0) {
      return NextResponse.json({ error: '音声データがありません' }, { status: 400 })
    }
    // 過大チャンクは弾く（数秒分のはず）
    if (audio.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: '音声チャンクが大きすぎます' }, { status: 413 })
    }

    // Check ownership/state/allowance before any paid provider call.
    const session = await prisma.cunningSession.findUnique({
      where: { id: sessionId }, select: { userId: true, status: true, recordingVersion: true },
    })
    if (!session || session.userId !== userId) return NextResponse.json({ error: 'セッションが見つかりません' }, { status: 404 })
    let audioReceivedAt: Date | null = null
    if (session.recordingVersion === 2) {
      const token = form.get('recordingToken')
      const final = form.get('final')
      if (typeof token !== 'string' || !token || token.length > 128 || (final !== null && final !== '0' && final !== '1')) {
        return NextResponse.json({ error: '録音識別子または音声の状態が不正です' }, { status: 400 })
      }
      const inputHash = final === '1' ? createHash('sha256').update(language + '\0').update(new Uint8Array(await audio.arrayBuffer())).digest('hex') : undefined
      const admission = await admitCunningAudio(prisma, userId, sessionId, token, speaker, final === '1', undefined, inputHash)
      if (typeof admission === 'object') {
        if (admission.state === 'cached') return NextResponse.json({ text: admission.text, transcriptId: admission.transcriptId, recordingFinal: true }, { headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } })
        audioReceivedAt = admission.receivedAt
        if (admission.claimedAt) claim = { userId, sessionId, token, speaker, claimedAt: admission.claimedAt }
      } else if (admission !== 'accepted') return NextResponse.json({ error: 'この音声は処理中か、受付期限または再試行回数の上限に達しています。', code: 'RECORDING_ENDED' }, { status: admission === 'missing' ? 404 : 409 })
    } else {
      if (session.status !== 'active') return NextResponse.json({ error: '終了したセッションでは文字起こしできません' }, { status: 409 })
      const allowance = await canStartSession(userId)
      if (!allowance.ok) return NextResponse.json({ error: allowance.reason, code: allowance.code ?? 'LIMIT', ...(allowance.upgradeAvailable ? { upgradeUrl: '/cunning/pricing' } : {}) }, { status: 403 })
    }

    const { text } = await transcribeChunk(audio, { filename: 'chunk.webm', language })
    let transcriptId: string | undefined
    const recordingFinal = session.recordingVersion === 2 && form.get('final') === '1'
    // An accepted in-flight chunk may finish after the user stops the session.
    // Persist it instead of silently returning unrecorded text. FK failure is reported.
    if (text || recordingFinal) {
      const saved = await writeCunningSession(userId, sessionId, async tx => {
        if (claim && !await hasCurrentCunningAudioClaim(tx, claim.userId, claim.sessionId, claim.token, claim.speaker, claim.claimedAt)) {
          throw Object.assign(new Error('Audio claim replaced'), { code: 'AUDIO_CLAIM_LOST' })
        }
        const row = await tx.cunningTranscript.create({ data: { sessionId, speaker, text, isFinal: true, recordingFinal, audioReceivedAt } })
        if (session.recordingVersion === 2) transcriptId = row.id
      })
      if (!saved) return NextResponse.json({ error: 'セッションが削除されました' }, { status: 409 })
    }

    return NextResponse.json({ text, ...(session.recordingVersion === 2 ? { transcriptId, recordingFinal } : {}) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: any) {
    if (e?.code === 'AUDIO_CLAIM_LOST') return NextResponse.json({ error: 'この音声は別の再試行で処理されています。再試行の結果を確認してください。', code: 'AUDIO_CLAIM_LOST' }, { status: 409 })
    if (claim) {
      try { await releaseFailedCunningAudio(prisma, claim.userId, claim.sessionId, claim.token, claim.speaker, claim.claimedAt) }
      catch { console.error('[cunning/transcribe] claim release failed') }
    }
    console.error('[cunning/transcribe] processing failed')
    return NextResponse.json({ error: '文字起こしに失敗しました' }, { status: 500 })
  }
}
