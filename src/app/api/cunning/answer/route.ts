export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/cunning/access'
import { writeCunningSession } from '@/lib/cunning/session-write'
import { canStartSession } from '@/lib/cunning/limits'
import { generateAnswer } from '@/lib/cunning/answer'
import { retrieveChunks } from '@/lib/cunning/rag'
import { resolveSessionContext } from '@/lib/cunning/context'
import { admitCunningAnswer, releaseFailedCunningAnswer, hasCurrentCunningAnswerClaim } from '@/lib/cunning/answer-admission'
import type { ApplicantProfileLite, CompanyProfileLite, CunningMode, KnowledgeChunkLite } from '@/lib/cunning/types'

// POST /api/cunning/answer — 質問テキスト → 回答(要点＋スクリプト＋根拠)
// body: { sessionId, question, recentTranscript? }
export async function POST(req: NextRequest) {
  const t0 = Date.now()
  let failedClaim: { userId: string; sessionId: string; token: string; claimedAt: Date } | undefined
  const releaseFailure = async () => {
    if (!failedClaim) return
    const claim = failedClaim
    failedClaim = undefined
    await releaseFailedCunningAnswer(prisma, claim.userId, claim.sessionId, claim.token, claim.claimedAt)
  }
  try {
    const userId = await getUserId()
    if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: '入力が不正です' }, { status: 400 })
    let question = typeof body.question === 'string' ? body.question.trim() : ''
    let finalAnswer = false
    let nativeRecording = false
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId.trim() : ''
    const language: 'ja' | 'en' | 'auto' = body.language === 'en' ? 'en' : body.language === 'auto' ? 'auto' : 'ja'
    if (!sessionId) return NextResponse.json({ error: '回答生成にはセッションが必要です' }, { status: 400 })
    if (!question) return NextResponse.json({ error: '質問が空です' }, { status: 400 })

    // セッションからモード・コンテキストを解決（所有確認は共有ヘルパー）
    let mode: CunningMode = 'sales'
    let chunks: KnowledgeChunkLite[] | undefined
    let company: CompanyProfileLite | null = null
    let applicant: ApplicantProfileLite | null = null
    let personaNote: string | null = null

    if (sessionId) {
      const ctx = await resolveSessionContext(userId, sessionId)
      if (!ctx) return NextResponse.json({ error: 'セッションが見つかりません' }, { status: 404 })
      if (ctx.recordingVersion === 2) {
        nativeRecording = true
        if (typeof body.recordingToken !== 'string' || (body.finalTranscriptId !== undefined && typeof body.finalTranscriptId !== 'string')) return NextResponse.json({ error: '録音識別子が不正です' }, { status: 400 })
        const admission = await admitCunningAnswer(prisma, userId, sessionId, body.recordingToken, body.finalTranscriptId, undefined, body.contextTranscriptIds, language)
        if (!admission.accepted) {
          const error = admission.reason === 'busy' ? '最終回答を処理中です。時間をおいて同じ内容で再試行してください。'
            : admission.reason === 'exhausted' ? '最終回答の再試行回数の上限に達しました。保存済みの発話は履歴で確認できます。'
            : admission.reason === 'conflict' ? '受付済みの最終回答と内容が異なるか、旧処理の確認が必要です。'
            : '回答の受付期限が切れているか、この録音では回答を生成できません。'
          return NextResponse.json({ error, code: 'RECORDING_ENDED', reason: admission.reason, retryAfterSeconds: admission.retryAfterSeconds }, { status: 409 })
        }
        if (admission.cached) return NextResponse.json(admission.cached, { headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } })
        if (admission.finalQuestion) { question = admission.finalQuestion; finalAnswer = true }
        if (admission.claimedAt) failedClaim = { userId, sessionId, token: body.recordingToken, claimedAt: admission.claimedAt }
      } else {
        if (ctx.status !== 'active') return NextResponse.json({ error: '終了したセッションでは回答生成できません' }, { status: 409 })
        const allowance = await canStartSession(userId)
        if (!allowance.ok) return NextResponse.json({ error: allowance.reason, code: allowance.code ?? 'LIMIT', ...(allowance.code === 'RECORDING_RESERVED' ? {} : { upgradeUrl: '/cunning/pricing' }) }, { status: 403 })
      }
      mode = ctx.mode
      company = ctx.company
      applicant = ctx.applicant
      personaNote = ctx.personaNote
      if (ctx.knowledgeBaseId) {
        chunks = await retrieveChunks(ctx.knowledgeBaseId, question, 4)
      }
    }

    const result = await generateAnswer({
      mode,
      question,
      recentTranscript: typeof body.recentTranscript === 'string' ? body.recentTranscript.slice(0, 1000) : undefined,
      chunks,
      company,
      applicant,
      personaNote,
      language,
    })

    // 空応答（モデルが中身を返さなかった）は保存も返却もしない
    if (!result.summary.trim() && !result.script.trim()) {
      await releaseFailure()
      return NextResponse.json({ error: finalAnswer ? '最終回答を生成できませんでした。受付期限内であれば再試行できます。保存済みの音声テキストは履歴で確認できます。' : '回答を生成できませんでした。もう一度お試しください' }, { status: 502 })
    }

    const latencyMs = Date.now() - t0

    // セッションがあれば質問と回答を保存
    if (sessionId) {
      const saved = await writeCunningSession(userId, sessionId, async tx => {
        if (failedClaim && !await hasCurrentCunningAnswerClaim(tx, failedClaim.userId, failedClaim.sessionId, failedClaim.token, failedClaim.claimedAt)) {
          throw Object.assign(new Error('Final answer claim replaced'), { code: 'ANSWER_CLAIM_LOST' })
        }
        // Native audio already has an owned transcript. Manual questions remain
        // durable in CunningAnswer.questionText without inventing an audio window.
        if (!finalAnswer && !nativeRecording) await tx.cunningTranscript.create({
          data: { sessionId, speaker: 'remote', text: question, isFinal: true },
        })
        await tx.cunningAnswer.create({
          data: {
            sessionId,
            questionText: question,
            finalTranscriptId: finalAnswer ? body.finalTranscriptId : null,
            summary: result.summary,
            script: result.script,
            sources: result.sources as any,
            model: result.model,
            latencyMs,
          },
        })
      })
      if (!saved) return NextResponse.json({ error: 'セッションが削除されました' }, { status: 409 })
    }

    return NextResponse.json(
      { ...result, latencyMs },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (e: any) {
    if (e?.code === 'ANSWER_CLAIM_LOST') return NextResponse.json({ error: 'この回答は別の再試行で処理されています。最新の結果を確認してください。', code: 'ANSWER_CLAIM_LOST' }, { status: 409 })
    if (!e?.cunningAnswerMayBeRunning) {
      try { await releaseFailure() } catch { console.error('[cunning/answer] claim release failed') }
    }
    console.error('[cunning/answer] processing failed')
    return NextResponse.json({ error: '回答生成に失敗しました' }, { status: 500 })
  }
}
