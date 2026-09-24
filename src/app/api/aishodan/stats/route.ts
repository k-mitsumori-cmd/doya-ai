export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// GET /api/aishodan/stats — ダッシュボード用の集計
// 未回答質問のランキングは「ナレッジ強化の優先順位」そのものなので必ず出す。
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAishodanContext, orgSlugFrom } from '@/lib/aishodan/access'

export async function GET(req: NextRequest) {
  const ctx = await getAishodanContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })

  // ⚠️ 練習の商談は指標に混ぜない。混ぜると自分の練習で完了率や日程調整率が
  //    動いてしまい、数字が事業の実態を表さなくなる。
  const real = { organizationId: ctx.organizationId, room: { isPreview: false } }

  const [total, evaluated, scheduled, byVerdict] = await Promise.all([
    prisma.aishodanSession.count({ where: real }),
    prisma.aishodanSession.count({ where: { ...real, status: 'evaluated' } }),
    // 一次商談の成果。⚠️ 完了率より、こちらの方が事業上の意味が大きい
    prisma.aishodanSession.count({ where: { ...real, schedulingClickedAt: { not: null } } }),
    prisma.aishodanOutcome.groupBy({
      by: ['verdict'],
      where: { session: real },
      _count: { verdict: true },
    }),
  ])

  // 所要時間と離脱フェーズも全件を母集団にする。500件で切ると商談数・完了率と
  // 集計対象がずれ、古い商談の離脱が消える。ページ単位で読むことでメモリも抑える。
  let cursor: string | undefined
  let durationSum = 0
  let durationCount = 0
  const dropoff: Record<string, number> = {}
  while (true) {
    const rows = await prisma.aishodanSession.findMany({
      where: { ...real, startedAt: { not: null }, endedAt: { not: null } },
      select: { id: true, startedAt: true, endedAt: true, currentPhase: true, status: true },
      orderBy: { id: 'asc' },
      take: 501,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })
    const page = rows.slice(0, 500)
    for (const session of page) {
      const minutes = (session.endedAt!.getTime() - session.startedAt!.getTime()) / 60000
      if (minutes > 0 && minutes < 120) {
        durationSum += minutes
        durationCount++
      }
      if (session.status !== 'evaluated' && session.status !== 'completed') {
        dropoff[session.currentPhase] = (dropoff[session.currentPhase] || 0) + 1
      }
    }
    if (rows.length <= 500) break
    cursor = page[page.length - 1].id
  }
  const avgMin = durationCount > 0 ? Math.round((durationSum / durationCount) * 10) / 10 : 0

  // 未回答の「新着順」では、何度も出る古い質問が消えてしまう。
  // 表記ゆれの小さいものだけをまとめ、同じ商談での反復は1件として数える。
  const unansweredByText = new Map<string, { id: string; text: string; sessions: Set<string>; createdAt: Date }>()
  let questionCursor: string | undefined
  while (true) {
    const rows = await prisma.aishodanQuestion.findMany({
      where: { session: real, unanswered: true },
      orderBy: { id: 'asc' },
      take: 501,
      ...(questionCursor ? { cursor: { id: questionCursor }, skip: 1 } : {}),
      select: { id: true, sessionId: true, text: true, createdAt: true },
    })
    const page = rows.slice(0, 500)
    for (const question of page) {
      const key = question.text.normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase('ja-JP')
      if (!key) continue
      const current = unansweredByText.get(key)
      if (current) {
        current.sessions.add(question.sessionId)
        if (question.createdAt > current.createdAt) {
          current.id = question.id
          current.text = question.text
          current.createdAt = question.createdAt
        }
      } else {
        unansweredByText.set(key, { id: question.id, text: question.text, sessions: new Set([question.sessionId]), createdAt: question.createdAt })
      }
    }
    if (rows.length <= 500) break
    questionCursor = page[page.length - 1].id
  }
  const unanswered = [...unansweredByText.values()]
    .map((item) => ({ ...item, count: item.sessions.size }))
    .sort((a, b) => b.count - a.count || b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id))
    .slice(0, 12)
    .map(({ id, text, count }) => ({ id, text, count }))

  return NextResponse.json({
    total,
    evaluated,
    scheduled,
    schedulingRate: total > 0 ? Math.round((scheduled / total) * 100) : 0,
    completionRate: total > 0 ? Math.round((evaluated / total) * 100) : 0,
    avgMin,
    byVerdict: Object.fromEntries(byVerdict.map((v) => [v.verdict, v._count.verdict])),
    unanswered,
    dropoff,
  }, { headers: { 'Cache-Control': 'private, no-store' } })
}
