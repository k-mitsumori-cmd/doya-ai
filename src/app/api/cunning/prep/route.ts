export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/cunning/access'
import { generatePrep } from '@/lib/cunning/prep'
import type { ApplicantProfileLite, CompanyProfileLite, CunningMode, KnowledgeChunkLite } from '@/lib/cunning/types'

// POST /api/cunning/prep — セッションのコンテキストから想定問答を生成
// body: { sessionId }
export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId()
    if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const sessionId = body.sessionId as string | undefined
    if (!sessionId) return NextResponse.json({ error: 'sessionIdが必要です' }, { status: 400 })

    const session = await prisma.cunningSession.findUnique({ where: { id: sessionId } })
    if (!session || session.userId !== userId) {
      return NextResponse.json({ error: 'セッションが見つかりません' }, { status: 404 })
    }

    const mode: CunningMode = session.mode === 'interview' ? 'interview' : 'sales'
    let chunks: KnowledgeChunkLite[] | undefined
    let company: CompanyProfileLite | null = null
    let applicant: ApplicantProfileLite | null = null

    if (mode === 'sales' && session.knowledgeBaseId) {
      const kb = await prisma.cunningKnowledgeBase.findUnique({
        where: { id: session.knowledgeBaseId },
        select: { userId: true },
      })
      if (kb && kb.userId === userId) {
        // 事前準備は全体傾向を見るため、先頭の代表チャンクを多めに渡す
        chunks = await prisma.cunningKnowledgeChunk.findMany({
          where: { knowledgeBaseId: session.knowledgeBaseId },
          select: { id: true, content: true, sourceUrl: true, sourceLabel: true },
          take: 10,
        })
      }
    }
    if (mode === 'interview') {
      if (session.companyProfileId) {
        const cp = await prisma.cunningCompanyProfile.findUnique({ where: { id: session.companyProfileId } })
        if (cp && cp.userId === userId) {
          company = { companyName: cp.companyName, businessSummary: cp.businessSummary, requirements: cp.requirements }
        }
      }
      if (session.applicantProfileId) {
        const ap = await prisma.cunningApplicantProfile.findUnique({ where: { id: session.applicantProfileId } })
        if (ap && ap.userId === userId) {
          applicant = { name: ap.name, resume: ap.resume, motivation: ap.motivation }
        }
      }
    }

    const items = await generatePrep({ mode, chunks, company, applicant, count: body.count })
    return NextResponse.json({ items }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: any) {
    console.error('[cunning/prep]', e?.message)
    return NextResponse.json({ error: '想定問答の生成に失敗しました' }, { status: 500 })
  }
}
