export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// POST /api/mensetsu/sessions/[id]/evaluate — 面接後の評価バッチ（F2）
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMensetsuContext, orgSlugFrom } from '@/lib/mensetsu/access'
import { evaluateSession } from '@/lib/mensetsu/evaluate'
import { LEVEL_LABELS, type MensetsuLevel, type Rubric } from '@/lib/mensetsu/types'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

export async function POST(req: NextRequest, ctx: Ctx) {
  const p = 'then' in ctx.params ? await ctx.params : ctx.params
  const c = await getMensetsuContext(orgSlugFrom(req))
  if (!c) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })

  const session = await prisma.mensetsuSession.findFirst({
    where: { id: p.id, organizationId: c.organizationId },
    include: {
      organization: { select: { name: true } },
      template: {
        include: {
          questions: { orderBy: { ord: 'asc' } },
          criteria: { orderBy: { ord: 'asc' } },
        },
      },
      turns: { orderBy: { ord: 'asc' } },
    },
  })
  if (!session) return NextResponse.json({ error: '見つかりません' }, { status: 404 })
  if (session.turns.length === 0) {
    return NextResponse.json({ error: '発話ログが無いため評価できません' }, { status: 400 })
  }

  const samples = await prisma.mensetsuAnswerSample.findMany({
    where: { organizationId: c.organizationId },
    take: 12,
    orderBy: { createdAt: 'desc' },
  })

  try {
    const result = await evaluateSession({
      jobTitle: session.template.jobTitle,
      levelLabel: LEVEL_LABELS[(session.template.level as MensetsuLevel) || 'mid'] || '中途',
      companyName: session.organization.name,
      criteria: session.template.criteria.map((x) => ({
        key: x.key,
        name: x.name,
        description: x.description,
        rubric: x.rubric as unknown as Rubric,
        weight: x.weight,
      })),
      questions: session.template.questions.map((q) => ({ ord: q.ord, text: q.text })),
      turns: session.turns.map((t) => ({ speaker: t.speaker, text: t.text, questionOrd: t.questionOrd })),
      samples: samples.map((s) => ({
        criterionKey: s.criterionKey,
        questionText: s.questionText,
        answerText: s.answerText,
        label: s.label,
      })),
    })

    const byKey = new Map(session.template.criteria.map((x) => [x.key, x.id]))

    await prisma.$transaction([
      prisma.mensetsuScore.deleteMany({ where: { sessionId: session.id } }),
      prisma.mensetsuScore.createMany({
        data: result.scores
          .filter((s) => byKey.has(s.criterionKey))
          .map((s) => ({
            sessionId: session.id,
            criterionId: byKey.get(s.criterionKey)!,
            score: s.score,
            insufficient: s.insufficient,
            rationale: s.rationale,
            quotes: s.quotes,
          })),
      }),
      prisma.mensetsuSession.update({
        where: { id: session.id },
        data: {
          status: 'evaluated',
          verdict: result.verdict,
          overallComment: result.overallComment,
          candidateFeedback: result.candidateFeedback,
          recruiterReport: result.recruiterReport,
          evaluatedAt: new Date(),
        },
      }),
    ])

    return NextResponse.json({ ok: true, verdict: result.verdict })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || '評価に失敗しました' }, { status: 502 })
  }
}
