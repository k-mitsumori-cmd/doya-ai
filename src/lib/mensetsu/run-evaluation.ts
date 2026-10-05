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
import { EVALUATION_STALE_MS, LEVEL_LABELS, type MensetsuLevel, type Rubric } from './types'

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
      // 分割送信の到着順ではなく発話時刻で並べる。時刻不明は末尾で記録順を保持。
      turns: { orderBy: [{ startMs: { sort: 'asc', nulls: 'last' } }, { ord: 'asc' }, { id: 'asc' }] },
    },
  })
  if (!session) return { ok: false, reason: '見つかりません', status: 404 }
  if (!session.startedAt || !session.endedAt || !['completed', 'evaluated', 'evaluating'].includes(session.status)) {
    return { ok: false, reason: '評価は面接が終了してから実行してください。', status: 409 }
  }
  if (session.turns.length === 0) {
    return { ok: false, reason: '発話ログが無いため評価できません', status: 400 }
  }
  const now = new Date()
  if (session.purgeAfter && session.purgeAfter <= now) {
    return { ok: false, reason: '記録の保管期限を過ぎているため評価できません。', status: 410 }
  }
  if (session.status === 'evaluating' && now.getTime() - session.updatedAt.getTime() < EVALUATION_STALE_MS) {
    return { ok: false, reason: 'この面接は評価中です。完了後に再度ご確認ください。', status: 409 }
  }
  const previousStatus = session.status === 'evaluating'
    ? (session.evaluatedAt ? 'evaluated' : 'completed')
    : session.status
  const claimAt = new Date(Math.max(now.getTime(), session.updatedAt.getTime() + 1))
  const claimed = await prisma.mensetsuSession.updateMany({
    where: { id: session.id, status: session.status, updatedAt: session.updatedAt },
    data: { status: 'evaluating', updatedAt: claimAt },
  })
  if (claimed.count !== 1) {
    return { ok: false, reason: 'この面接は別の操作で評価中です。再読み込みしてください。', status: 409 }
  }
  const releaseClaim = async () => {
    // 別の処理が実行権を取得済みなら、その行には触れない。
    await prisma.mensetsuSession.updateMany({
      where: { id: session.id, status: 'evaluating', updatedAt: claimAt },
      data: { status: previousStatus, updatedAt: new Date(Math.max(Date.now(), claimAt.getTime() + 1)) },
    }).catch(() => console.error('[mensetsu] 評価失敗後の状態復旧に失敗'))
  }

  try {
    const samples = await prisma.mensetsuAnswerSample.findMany({
      where: { organizationId: session.organization.id },
      take: 12,
      orderBy: { createdAt: 'desc' },
    })
    // 追加発話が届いたら同じ実行権で順番に再評価する。古い結果は保存しない。
    // 連続した追記で実行時間を使い切らないよう、3回または再試行開始まで180秒で止める。
    for (let attempt = 0; attempt < 3; attempt++) {
      const turns = await prisma.mensetsuTurn.findMany({
        where: { sessionId: session.id },
        orderBy: [{ startMs: { sort: 'asc', nulls: 'last' } }, { ord: 'asc' }, { id: 'asc' }],
      })
      if (!turns.length) {
        await releaseClaim()
        return { ok: false, reason: '発話ログが無いため評価できません', status: 400 }
      }
      if (session.purgeAfter && session.purgeAfter.getTime() <= Date.now()) {
        await releaseClaim()
        return { ok: false, reason: '記録の保管期限を過ぎているため評価できません。', status: 410 }
      }
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
        turns: turns.map((t) => ({ speaker: t.speaker, text: t.text, questionOrd: t.questionOrd })),
        samples: samples.map((s) => ({
          criterionKey: s.criterionKey,
          questionText: s.questionText,
          answerText: s.answerText,
          label: s.label,
        })),
      })

      const byKey = new Map(session.template.criteria.map((x) => [x.key, x.id]))

      const saved = await prisma.$transaction(async (tx) => {
        // 更新で発話保存と同じ行をロックし、次の問い合わせはロック取得後の発話を見る。
        // 更新日時を変えず、再評価中も実行権を維持する。
        const owner = await tx.mensetsuSession.updateMany({
          where: {
            id: session.id, status: 'evaluating', updatedAt: claimAt,
            OR: [{ purgeAfter: null }, { purgeAfter: { gt: new Date() } }],
          },
          data: { updatedAt: claimAt },
        })
        if (owner.count !== 1) return 'lost' as const
        const currentTurns = await tx.mensetsuTurn.findMany({ where: { sessionId: session.id }, select: { id: true } })
        const inputIds = new Set(turns.map((turn) => turn.id))
        if (currentTurns.length !== turns.length || currentTurns.some((turn) => !inputIds.has(turn.id))) return 'changed' as const
        const finalized = await tx.mensetsuSession.updateMany({
          where: {
            id: session.id, status: 'evaluating', updatedAt: claimAt,
            OR: [{ purgeAfter: null }, { purgeAfter: { gt: new Date() } }],
          },
          data: {
            status: 'evaluated',
            verdict: result.verdict,
            overallComment: result.overallComment,
            candidateFeedback: result.candidateFeedback,
            recruiterReport: result.recruiterReport,
            evaluatedAt: new Date(),
            updatedAt: new Date(Math.max(Date.now(), claimAt.getTime() + 1)),
          },
        })
        if (finalized.count !== 1) return 'lost' as const
        await tx.mensetsuScore.deleteMany({ where: { sessionId: session.id } })
        await tx.mensetsuScore.createMany({
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
        })
        return 'saved' as const
      }, { isolationLevel: 'ReadCommitted', timeout: 15000 })
      if (saved === 'changed' && attempt < 2 && Date.now() - now.getTime() < 180000) continue
      if (saved !== 'saved') {
        await releaseClaim()
        return { ok: false, reason: saved === 'changed'
          ? '評価中に追加の発話が届きました。最新の発話で再評価してください。'
          : '評価中に面接の状態が変わりました。再読み込みしてください。', status: 409 }
      }

      return { ok: true, verdict: result.verdict }
    }
    await releaseClaim()
    return { ok: false, reason: '最新の発話で再評価してください。', status: 409 }
  } catch (error) {
    await releaseClaim()
    throw error
  }
}
