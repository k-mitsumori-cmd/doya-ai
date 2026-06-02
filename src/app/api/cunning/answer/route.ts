export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/cunning/access'
import { generateAnswer } from '@/lib/cunning/answer'
import { retrieveChunks } from '@/lib/cunning/rag'
import type { ApplicantProfileLite, CompanyProfileLite, CunningMode } from '@/lib/cunning/types'

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

    // セッションからモード・コンテキストを解決
    let mode: CunningMode = 'sales'
    let chunks = undefined as any
    let company: CompanyProfileLite | null = null
    let applicant: ApplicantProfileLite | null = null

    if (sessionId) {
      const session = await prisma.cunningSession.findUnique({ where: { id: sessionId } })
      if (!session || session.userId !== userId) {
        return NextResponse.json({ error: 'セッションが見つかりません' }, { status: 404 })
      }
      mode = session.mode === 'interview' ? 'interview' : 'sales'

      if (mode === 'sales' && session.knowledgeBaseId) {
        // ナレッジ所有確認の上で関連チャンクを検索
        const kb = await prisma.cunningKnowledgeBase.findUnique({
          where: { id: session.knowledgeBaseId },
          select: { userId: true },
        })
        if (kb && kb.userId === userId) {
          chunks = await retrieveChunks(session.knowledgeBaseId, question, 4)
        }
      }
      if (mode === 'interview') {
        if (session.companyProfileId) {
          const cp = await prisma.cunningCompanyProfile.findUnique({
            where: { id: session.companyProfileId },
          })
          if (cp && cp.userId === userId) {
            company = {
              companyName: cp.companyName,
              businessSummary: cp.businessSummary,
              requirements: cp.requirements,
            }
          }
        }
        if (session.applicantProfileId) {
          const ap = await prisma.cunningApplicantProfile.findUnique({
            where: { id: session.applicantProfileId },
          })
          if (ap && ap.userId === userId) {
            applicant = { name: ap.name, resume: ap.resume, motivation: ap.motivation }
          }
        }
      }
    }

    const result = await generateAnswer({
      mode,
      question,
      recentTranscript: typeof body.recentTranscript === 'string' ? body.recentTranscript.slice(0, 1000) : undefined,
      chunks,
      company,
      applicant,
    })

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
