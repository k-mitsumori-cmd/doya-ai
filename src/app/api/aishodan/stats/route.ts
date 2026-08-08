export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/aishodan/stats — ダッシュボード用の集計
// 未回答質問のランキングは「ナレッジ強化の優先順位」そのものなので必ず出す。
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAishodanContext, orgSlugFrom } from '@/lib/aishodan/access'

export async function GET(req: NextRequest) {
  const ctx = await getAishodanContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })

  const [total, evaluated, byVerdict, unanswered, sessions] = await Promise.all([
    prisma.aishodanSession.count({ where: { organizationId: ctx.organizationId } }),
    prisma.aishodanSession.count({ where: { organizationId: ctx.organizationId, status: 'evaluated' } }),
    prisma.aishodanOutcome.groupBy({
      by: ['verdict'],
      where: { session: { organizationId: ctx.organizationId } },
      _count: { verdict: true },
    }),
    prisma.aishodanQuestion.findMany({
      where: { session: { organizationId: ctx.organizationId }, unanswered: true },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: { id: true, text: true, createdAt: true },
    }),
    prisma.aishodanSession.findMany({
      where: { organizationId: ctx.organizationId, startedAt: { not: null }, endedAt: { not: null } },
      select: { startedAt: true, endedAt: true, currentPhase: true, status: true },
      take: 500,
    }),
  ])

  const durations = sessions
    .map((s) => (s.endedAt!.getTime() - s.startedAt!.getTime()) / 60000)
    .filter((n) => n > 0 && n < 120)
  const avgMin = durations.length > 0 ? Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10 : 0

  // 離脱フェーズ = 完了しなかった商談が止まったところ。シナリオの弱点が出る
  const dropoff: Record<string, number> = {}
  for (const s of sessions) {
    if (s.status === 'evaluated' || s.status === 'completed') continue
    dropoff[s.currentPhase] = (dropoff[s.currentPhase] || 0) + 1
  }

  return NextResponse.json({
    total,
    evaluated,
    completionRate: total > 0 ? Math.round((evaluated / total) * 100) : 0,
    avgMin,
    byVerdict: Object.fromEntries(byVerdict.map((v) => [v.verdict, v._count.verdict])),
    unanswered,
    dropoff,
  })
}
