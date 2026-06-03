export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/cunning/access'
import { generateAnswer } from '@/lib/cunning/answer'
import { retrieveChunks } from '@/lib/cunning/rag'
import { resolveSessionContext } from '@/lib/cunning/context'
import type { ApplicantProfileLite, CompanyProfileLite, CunningMode, KnowledgeChunkLite } from '@/lib/cunning/types'

// POST /api/cunning/answer — 質問テキスト → 回答(要点＋スクリプト＋根拠)
// body: { sessionId, question, recentTranscript? }
export async function POST(req: NextRequest) {
  const t0 = Date.now()
  try {
    const userId = await getUserId()
    if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const question = (body.question as string)?.trim()
    const sessionId = body.sessionId as string | undefined
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
    })

    // 空応答（モデルが中身を返さなかった）は保存も返却もしない
    if (!result.summary.trim() && !result.script.trim()) {
      return NextResponse.json({ error: '回答を生成できませんでした。もう一度お試しください' }, { status: 502 })
    }

    const latencyMs = Date.now() - t0

    // セッションがあれば質問と回答を保存
    if (sessionId) {
      await prisma.$transaction([
        prisma.cunningTranscript.create({
          data: { sessionId, speaker: 'remote', text: question, isFinal: true },
        }),
        prisma.cunningAnswer.create({
          data: {
            sessionId,
            questionText: question,
            summary: result.summary,
            script: result.script,
            sources: result.sources as any,
            model: result.model,
            latencyMs,
          },
        }),
      ])
    }

    return NextResponse.json(
      { ...result, latencyMs },
      { headers: { 'Cache-Control': 'no-store' } }
    )
  } catch (e: any) {
    console.error('[cunning/answer]', e?.message)
    return NextResponse.json({ error: '回答生成に失敗しました' }, { status: 500 })
  }
}
