export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// GET /api/mensetsu/sessions/[id] — 評価レポート・逐語ログ（採用担当者向け）
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMensetsuContext, orgSlugFrom } from '@/lib/mensetsu/access'
import { weightedAverage } from '@/lib/mensetsu/evaluate'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

export async function GET(req: NextRequest, ctx: Ctx) {
  const p = 'then' in ctx.params ? await ctx.params : ctx.params
  const c = await getMensetsuContext(orgSlugFrom(req))
  if (!c) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })

  // id だけで他組織の面接に到達させない（二重条件）
  const session = await prisma.mensetsuSession.findFirst({
    where: { id: p.id, organizationId: c.organizationId },
    include: {
      template: {
        include: {
          questions: { orderBy: { ord: 'asc' } },
          criteria: { orderBy: { ord: 'asc' } },
        },
      },
      turns: { orderBy: { ord: 'asc' } },
      scores: { include: { criterion: true } },
    },
  })
  if (!session) return NextResponse.json({ error: '見つかりません' }, { status: 404 })

  const average = weightedAverage(
    session.scores.map((s) => ({
      criterionKey: s.criterion.key,
      score: s.score,
      insufficient: s.insufficient,
      rationale: s.rationale || '',
      quotes: s.quotes,
    })),
    session.template.criteria.map((c2) => ({ key: c2.key, weight: c2.weight }))
  )

  return NextResponse.json({ session, average })
}
