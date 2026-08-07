export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// POST /api/mensetsu/live/[token]/advance — 進行制御（function calling のバックエンド）
// 深掘りするか次の主質問へ進むかは、モデルではなくサーバが決める。
// これにより「全応募者に同じ主質問」という構造化面接の前提が守られる。
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { assertUsable, loadSessionByToken } from '@/lib/mensetsu/public'
import { advance } from '@/lib/mensetsu/interview'

type Ctx = { params: Promise<{ token: string }> | { token: string } }

export async function POST(req: NextRequest, ctx: Ctx) {
  const p = 'then' in ctx.params ? await ctx.params : ctx.params
  const s = await loadSessionByToken(p.token)
  if (!s) return NextResponse.json({ error: '面接が見つかりません' }, { status: 404 })
  if (!s.consentedAt) return NextResponse.json({ error: '同意が必要です' }, { status: 403 })

  const usable = assertUsable(s)
  if (!usable.ok) return NextResponse.json({ error: usable.reason }, { status: usable.status })

  const body = await req.json().catch(() => ({}))
  const intent = body?.intent === 'follow_up' ? 'follow_up' : 'next'

  const elapsedSec = s.startedAt ? Math.floor((Date.now() - s.startedAt.getTime()) / 1000) : 0

  const result = advance({
    currentIndex: s.currentIndex,
    followUpCount: s.followUpCount,
    totalQuestions: s.template.questions.length,
    elapsedSec,
    durationMin: s.template.durationMin,
    intent,
    questions: s.template.questions,
  })

  await prisma.mensetsuSession.update({
    where: { id: s.id },
    data: {
      currentIndex: result.questionOrd ?? s.currentIndex,
      followUpCount: result.followUpCount,
      ...(result.shouldClose ? { status: 'live' } : {}),
    },
  })

  return NextResponse.json({
    action: result.action,
    next_question: result.questionText,
    question_number: result.questionOrd != null ? result.questionOrd + 1 : null,
    remaining: result.remainingCount,
    should_close: result.shouldClose,
  })
}
