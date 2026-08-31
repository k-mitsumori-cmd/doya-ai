export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// GET /api/mensetsu/compare?templateId=xxx — 候補者の横並び比較（F4-4）
//
// 既定は「すべて」。評価済みの候補者を職種をまたいで一覧し、順位を出す。
// ⚠️ 別テンプレートは評価軸そのものが違うので、**評価軸ごとの点数は横並びにしない**。
//    並べてよいのは「重み付き平均」と「判定」だけ。ここを混ぜると、基準の違う点数を
//    同じ列で比べることになり誤った採用判断につながる。
//    テンプレートを指定した場合だけ、評価軸ごとの点数と中央値も返す。
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMensetsuContext, orgSlugFrom } from '@/lib/mensetsu/access'
import { weightedAverage } from '@/lib/mensetsu/evaluate'

export async function GET(req: NextRequest) {
  const c = await getMensetsuContext(orgSlugFrom(req))
  if (!c) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })

  const templateId = new URL(req.url).searchParams.get('templateId') || ''
  const isAll = !templateId || templateId === 'all'

  // 他組織のテンプレートを覗けないよう二重条件
  const template = isAll
    ? null
    : await prisma.mensetsuTemplate.findFirst({
        where: { id: templateId, organizationId: c.organizationId },
        include: {
          criteria: { orderBy: { ord: 'asc' } },
          questions: { orderBy: { ord: 'asc' } },
        },
      })
  if (!isAll && !template) {
    return NextResponse.json({ error: 'テンプレートが見つかりません' }, { status: 404 })
  }

  const sessions = await prisma.mensetsuSession.findMany({
    where: {
      organizationId: c.organizationId,
      status: 'evaluated',
      ...(isAll ? {} : { templateId }),
    },
    orderBy: { endedAt: 'desc' },
    take: 50,
    select: {
      id: true,
      candidateName: true,
      verdict: true,
      endedAt: true,
      overallComment: true,
      // 「すべて」表示では、どの職種で受けたのかが分からないと比較にならない
      template: { select: { id: true, name: true, jobTitle: true, criteria: { select: { id: true, key: true, weight: true } } } },
      scores: { select: { criterionId: true, score: true, insufficient: true } },
    },
  })

  const candidates = sessions.map((s) => {
    // ⚠️ 重みと評価軸は「その候補者が受けたテンプレート」のものを使う。
    //    すべて表示では候補者ごとにテンプレートが異なるため、
    //    画面で選んでいるテンプレートの重みを当てると平均が狂う。
    const ownCriteria = s.template.criteria
    const weights = ownCriteria.map((x) => ({ key: x.key, weight: x.weight }))
    const byId = new Map(ownCriteria.map((x) => [x.id, x.key]))
    const scores = s.scores.map((x) => ({
      criterionKey: byId.get(x.criterionId) || '',
      score: x.score,
      insufficient: x.insufficient,
      rationale: '',
      quotes: [] as string[],
    }))
    return {
      id: s.id,
      name: s.candidateName,
      verdict: s.verdict,
      endedAt: s.endedAt,
      overallComment: s.overallComment,
      templateName: s.template.name,
      jobTitle: s.template.jobTitle,
      average: weightedAverage(scores, weights),
      scores: Object.fromEntries(
        scores.map((x) => [x.criterionKey, x.insufficient ? null : x.score])
      ) as Record<string, number | null>,
    }
  })

  // 評価軸ごとの中央値。相対的に高い/低いを見るための基準線として返す。
  // 平均だと1人の極端な点に引きずられるため中央値を使う。
  const medians: Record<string, number | null> = {}
  for (const cr of template?.criteria ?? []) {
    const vals = candidates
      .map((x) => x.scores[cr.key])
      .filter((v): v is number => typeof v === 'number')
      .sort((a, b) => a - b)
    medians[cr.key] =
      vals.length === 0
        ? null
        : vals.length % 2
          ? vals[(vals.length - 1) / 2]
          : Math.round(((vals[vals.length / 2 - 1] + vals[vals.length / 2]) / 2) * 10) / 10
  }

  return NextResponse.json({
    // すべて表示のときは評価軸を返さない（基準が違うものを横並びにしない）
    template: template
      ? {
          id: template.id,
          name: template.name,
          jobTitle: template.jobTitle,
          criteria: template.criteria.map((x) => ({ key: x.key, name: x.name, weight: x.weight })),
        }
      : { id: 'all', name: 'すべて', jobTitle: '', criteria: [] },
    candidates,
    medians,
  })
}
