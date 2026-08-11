export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET  /api/aishodan/rooms — ルーム一覧
// POST /api/aishodan/rooms — 公開ルームを発行
import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAishodanContext, orgSlugFrom } from '@/lib/aishodan/access'

export async function GET(req: NextRequest) {
  const ctx = await getAishodanContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })
  const rooms = await prisma.aishodanRoom.findMany({
    // ⚠️ 練習ルームは配布するURLではないので一覧に出さない。
    //    混ぜると「どれを配ればいいのか」が分からなくなる。
    where: { organizationId: ctx.organizationId, isPreview: false },
    orderBy: { createdAt: 'desc' },
    include: {
      scenario: { select: { id: true, name: true, product: { select: { name: true } } } },
      _count: { select: { sessions: true } },
    },
    take: 100,
  })
  return NextResponse.json({ rooms })
}

export async function POST(req: NextRequest) {
  const ctx = await getAishodanContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const scenarioId = String(body?.scenarioId || '')
  if (!scenarioId) return NextResponse.json({ error: 'シナリオを選択してください' }, { status: 400 })

  // 他組織のシナリオでルームを作らせない
  const scenario = await prisma.aishodanScenario.findFirst({
    where: { id: scenarioId, product: { organizationId: ctx.organizationId } },
    include: { product: { select: { name: true } } },
  })
  if (!scenario) return NextResponse.json({ error: 'シナリオが見つかりません' }, { status: 404 })

  // ⚠️ 公開URLのトークンは推測できてはいけない。乱数から作る
  const token = randomBytes(24).toString('base64url')

  const days = Number(body?.expiresInDays)
  const room = await prisma.aishodanRoom.create({
    data: {
      organizationId: ctx.organizationId,
      scenarioId: scenario.id,
      name: String(body?.name || `${scenario.product.name} 商談ルーム`).slice(0, 200),
      token,
      expiresAt: Number.isFinite(days) && days > 0 ? new Date(Date.now() + days * 24 * 60 * 60 * 1000) : null,
      maxSessions: Number.isFinite(Number(body?.maxSessions))
        ? Math.max(1, Math.min(5000, Math.round(Number(body.maxSessions))))
        : 500,
    },
  })

  return NextResponse.json({ room: { id: room.id, name: room.name, token: room.token, expiresAt: room.expiresAt } })
}
