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
import { chooseBranch } from '@/lib/mensetsu/branch'
import { prisma as db } from '@/lib/prisma'

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
  const answerSummary = String(body?.answer_summary || '').trim()

  const elapsedSec = s.startedAt ? Math.floor((Date.now() - s.startedAt.getTime()) / 1000) : 0

  // --- 分岐 ---
  // 深掘りに入る局面で、いまの主質問に枝があれば回答から選ぶ。
  // 枝が選ばれたらその深掘り質問を返し、skipToOrd があれば飛び先を指示する。
  if (intent === 'follow_up' && s.followUpCount === 0) {
    const q = await db.mensetsuQuestion.findFirst({
      where: { templateId: s.templateId, ord: s.currentIndex },
      include: { branches: { orderBy: { ord: 'asc' } } },
    })
    if (q && q.branches.length > 0) {
      // 回答は function call の要約を優先し、無ければ直近の応募者発話を使う
      let answer = answerSummary
      if (!answer) {
        const last = await db.mensetsuTurn.findFirst({
          where: { sessionId: s.id, speaker: 'candidate' },
          orderBy: { ord: 'desc' },
          select: { text: true },
        })
        answer = last?.text || ''
      }
      const { branch, reason } = await chooseBranch(answer, q.branches)
      if (branch) {
        // 前提が崩れて後続が無意味になる場合だけ飛ばす
        if (branch.skipToOrd != null && branch.skipToOrd > s.currentIndex) {
          const total = await db.mensetsuQuestion.count({ where: { templateId: s.templateId } })
          const target = Math.min(branch.skipToOrd, total - 1)
          const nq = await db.mensetsuQuestion.findFirst({
            where: { templateId: s.templateId, ord: target },
            select: { text: true },
          })
          await prisma.mensetsuSession.update({
            where: { id: s.id },
            data: { currentIndex: target, followUpCount: 0 },
          })
          return NextResponse.json({
            action: 'next_question',
            next_question: nq?.text ?? null,
            question_number: target + 1,
            remaining: Math.max(0, total - target - 1),
            should_close: false,
            branch: { label: branch.label, reason, skipped: true },
          })
        }

        if (branch.text) {
          await prisma.mensetsuSession.update({
            where: { id: s.id },
            data: { followUpCount: s.followUpCount + 1 },
          })
          return NextResponse.json({
            action: 'follow_up',
            next_question: branch.text,
            question_number: s.currentIndex + 1,
            remaining: null,
            should_close: false,
            branch: { label: branch.label, reason, skipped: false },
          })
        }
      }
    }
  }

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
