export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// GET /api/mensetsu/compare?templateId=xxx — 候補者の横並び比較（F4-4）
//
// 同じテンプレート（＝同じ主質問・同じ評価基準）で受けた候補者だけを並べる。
// 別テンプレート同士を並べると、基準の違う点数を比較することになり誤った判断を招くため、
// templateId は必須にしている。
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMensetsuContext, orgSlugFrom } from '@/lib/mensetsu/access'
import { weightedAverage } from '@/lib/mensetsu/evaluate'

export async function GET(req: NextRequest) {
  const c = await getMensetsuContext(orgSlugFrom(req))
  if (!c) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })

  const templateId = new URL(req.url).searchParams.get('templateId') || ''
  if (!templateId) {
    return NextResponse.json({ error: 'テンプレートを指定してください' }, { status: 400 })
  }

  // 他組織のテンプレートを覗けないよう二重条件
  const template = await prisma.mensetsuTemplate.findFirst({
    where: { id: templateId, organizationId: c.organizationId },
    include: {
      criteria: { orderBy: { ord: 'asc' } },
      questions: { orderBy: { ord: 'asc' } },
    },
  })
  if (!template) return NextResponse.json({ error: 'テンプレートが見つかりません' }, { status: 404 })

  const sessions = await prisma.mensetsuSession.findMany({
    where: { organizationId: c.organizationId, templateId, status: 'evaluated' },
    orderBy: { endedAt: 'desc' },
    take: 50,
    select: {
      id: true,
      candidateName: true,
      verdict: true,
      endedAt: true,
      overallComment: true,
      scores: { select: { criterionId: true, score: true, insufficient: true } },
    },
  })

  const weights = template.criteria.map((x) => ({ key: x.key, weight: x.weight }))
  const byId = new Map(template.criteria.map((x) => [x.id, x.key]))

  const candidates = sessions.map((s) => {
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
      average: weightedAverage(scores, weights),
      scores: Object.fromEntries(
        scores.map((x) => [x.criterionKey, x.insufficient ? null : x.score])
      ) as Record<string, number | null>,
    }
  })

  // 評価軸ごとの中央値。相対的に高い/低いを見るための基準線として返す。
  // 平均だと1人の極端な点に引きずられるため中央値を使う。
  const medians: Record<string, number | null> = {}
  for (const cr of template.criteria) {
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
    template: {
      id: template.id,
      name: template.name,
      jobTitle: template.jobTitle,
      criteria: template.criteria.map((x) => ({ key: x.key, name: x.name, weight: x.weight })),
    },
    candidates,
    medians,
  })
}
