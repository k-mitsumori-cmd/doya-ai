// ============================================
// 面接の評価を実行して保存する（共通処理）
// ============================================
// ⚠️ 呼び出し口が2つある。両方が同じここを通ること。
//   1. 面接が終わった直後の自動評価（live/[token]/end）
//      → 応募者が終えた時点で採用担当者は何もしなくてよい状態にする
//   2. 担当者が一覧から手で押す「評価する」（sessions/[id]/evaluate）
//      → 自動評価が失敗したときのやり直し口
// 片方だけ直すと「自動と手動で結果が違う」という最悪の混乱になる。
//
// ⚠️ 組織スコープの確認はここでは行わない。呼び出し側の責務。
//    自動評価は応募者のトークン経由で走るためログインセッションが無い。
import { prisma } from '@/lib/prisma'
import { evaluateSession } from './evaluate'
import { LEVEL_LABELS, type MensetsuLevel, type Rubric } from './types'

export type RunEvaluationResult =
  | { ok: true; verdict: string }
  | { ok: false; reason: string; status: number }

/** sessionId を渡すと評価を実行し、結果を保存して status を evaluated にする */
export async function runEvaluation(sessionId: string): Promise<RunEvaluationResult> {
  const session = await prisma.mensetsuSession.findUnique({
    where: { id: sessionId },
    include: {
      organization: { select: { id: true, name: true } },
      template: {
        include: {
          questions: { orderBy: { ord: 'asc' } },
          criteria: { orderBy: { ord: 'asc' } },
        },
      },
      turns: { orderBy: { ord: 'asc' } },
    },
  })
  if (!session) return { ok: false, reason: '見つかりません', status: 404 }
  if (session.turns.length === 0) {
    return { ok: false, reason: '発話ログが無いため評価できません', status: 400 }
  }

  const samples = await prisma.mensetsuAnswerSample.findMany({
    where: { organizationId: session.organization.id },
    take: 12,
    orderBy: { createdAt: 'desc' },
  })

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

  return { ok: true, verdict: result.verdict }
}
