export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/cunning/access'
import { generateReport } from '@/lib/cunning/report'
import type { CunningMode } from '@/lib/cunning/types'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

// POST /api/cunning/sessions/[id]/report — 議事録＋評価を生成して保存。
// body: { force?: boolean } 既存があれば再生成せず返す（force=trueで再生成）
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const userId = await getUserId()
    if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    const p = 'then' in ctx.params ? await ctx.params : ctx.params

    const session = await prisma.cunningSession.findUnique({
      where: { id: p.id },
      include: {
        transcripts: { orderBy: { createdAt: 'asc' }, take: 200, select: { text: true, speaker: true } },
        answers: {
          orderBy: { createdAt: 'asc' },
          take: 100,
          select: { questionText: true, summary: true, script: true },
        },
      },
    })
    if (!session || session.userId !== userId) {
      return NextResponse.json({ error: '見つかりません' }, { status: 404 })
    }

    const body = await req.json().catch(() => ({}))
    if (session.report && body.force !== true) {
      return NextResponse.json({ report: session.report }, { headers: { 'Cache-Control': 'no-store' } })
    }

    const report = await generateReport({
      mode: session.mode as CunningMode,
      transcripts: session.transcripts.map((t) => `${t.speaker === 'self' ? '自分' : '相手'}: ${t.text}`),
      answers: session.answers.map((a) => ({ question: a.questionText, summary: a.summary, script: a.script })),
      personaNote: session.personaNote,
    })

    await prisma.cunningSession.update({ where: { id: p.id }, data: { report: report as any } })
    return NextResponse.json({ report }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: any) {
    console.error('[cunning/report]', e?.message)
    return NextResponse.json({ error: '議事録の生成に失敗しました' }, { status: 500 })
  }
}
