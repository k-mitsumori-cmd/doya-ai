export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// POST /api/aishodan/scenarios/[id]/preview — 練習用の商談URLを発行（使い回す）
//
// ⚠️ 練習は**本番と同じコードパス**を通す。専用の簡易モードを作ると、
//    そこで直したつもりのシナリオが本番で違う挙動をする。
//    通常のルームに isPreview を立てるだけにしてある。
//
// ⚠️ 呼ぶたびに新しいルームを作らない。シナリオごとに1つを使い回す。
//    毎回作ると、練習のたびにルーム一覧が汚れていく。
import { randomBytes } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAishodanContext, orgSlugFrom } from '@/lib/aishodan/access'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

/** 練習ルームの有効期間。⚠️ 期限切れなら作り直すので、短くても困らない */
const PREVIEW_DAYS = 30

export async function POST(req: NextRequest, ctxParam: Ctx) {
  const p = 'then' in ctxParam.params ? await ctxParam.params : ctxParam.params
  const ctx = await getAishodanContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })

  // 他組織のシナリオで練習ルームを作らせない
  const scenario = await prisma.aishodanScenario.findFirst({
    where: { id: p.id, product: { organizationId: ctx.organizationId } },
    include: { product: { select: { name: true } } },
  })
  if (!scenario) return NextResponse.json({ error: 'シナリオが見つかりません' }, { status: 404 })

  const expiresAt = new Date(Date.now() + PREVIEW_DAYS * 24 * 60 * 60 * 1000)

  // 既存の練習ルームがあれば、期限と上限を伸ばして使い回す
  const existing = await prisma.aishodanRoom.findFirst({
    where: { organizationId: ctx.organizationId, scenarioId: scenario.id, isPreview: true },
    orderBy: { createdAt: 'desc' },
  })
  if (existing) {
    const room = await prisma.aishodanRoom.update({
      where: { id: existing.id },
      data: {
        isActive: true,
        expiresAt,
        // ⚠️ 練習を繰り返すと sessionCount が上限に当たって開けなくなる。
        //    使うたびに枠を足しておく。
        maxSessions: existing.sessionCount + 50,
      },
      select: { token: true },
    })
    return NextResponse.json({ token: room.token, reused: true })
  }

  const room = await prisma.aishodanRoom.create({
    data: {
      organizationId: ctx.organizationId,
      scenarioId: scenario.id,
      name: `【練習】${scenario.product.name}`,
      token: randomBytes(24).toString('base64url'),
      expiresAt,
      maxSessions: 50,
      isPreview: true,
    },
    select: { token: true },
  })
  return NextResponse.json({ token: room.token, reused: false })
}
