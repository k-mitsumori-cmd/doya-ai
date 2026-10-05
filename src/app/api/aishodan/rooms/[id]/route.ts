export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// PATCH  /api/aishodan/rooms/[id] — 公開の停止・再開、上限の変更
// DELETE /api/aishodan/rooms/[id] — ルーム削除
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAishodanContext, hasMinRole, orgSlugFrom } from '@/lib/aishodan/access'
import { parseRoomExpiryDays, parseRoomMaxSessions } from '@/lib/aishodan/room-input'

type Ctx = { params: Promise<{ id: string }> }

export async function PATCH(req: NextRequest, ctxParam: Ctx) {
  const p = await ctxParam.params
  const ctx = await getAishodanContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })
  // ⚠️ 公開停止・上限変更は配布済みURLの挙動を変える（見込み客が商談に入れなくなる）。
  //    同じルームの DELETE が admin 以上なのに PATCH だけ member でも通る状態だった。
  if (!hasMinRole(ctx.role, 'manager')) {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: '入力内容が正しくありません' }, { status: 400 })
  }
  const data: Record<string, unknown> = {}
  if ('isActive' in body) {
    if (typeof body.isActive !== 'boolean') return NextResponse.json({ error: '公開状態が正しくありません' }, { status: 400 })
    data.isActive = body.isActive
  }
  if ('name' in body && String(body.name).trim()) data.name = String(body.name).trim().slice(0, 200)
  if ('maxSessions' in body) {
    const maxSessions = parseRoomMaxSessions(body.maxSessions)
    if (maxSessions === null) return NextResponse.json({ error: '最大商談回数は1〜5000の整数で入力してください' }, { status: 400 })
    data.maxSessions = maxSessions
  }
  if ('expiresInDays' in body) {
    const expiresAt = parseRoomExpiryDays(body.expiresInDays)
    if (expiresAt === undefined) return NextResponse.json({ error: '有効期限の日数が正しくありません' }, { status: 400 })
    data.expiresAt = expiresAt
  }

  try {
    const result = await prisma.$transaction(async tx => {
      const room = await tx.aishodanRoom.findFirst({
        where: { id: p.id, organizationId: ctx.organizationId },
        select: { scenario: { select: { productId: true } } },
      })
      if (!room) return 'not-found' as const
      if (data.isActive === true) {
        // 商材保管と同じ行をロックし、再公開が保管後に確定するのを防ぐ。
        const locked = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM aishodan_products WHERE id = ${room.scenario.productId}
          AND "organizationId" = ${ctx.organizationId} FOR NO KEY UPDATE
        `
        if (!locked.length) return 'archived' as const
        const product = await tx.aishodanProduct.findFirst({
          where: { id: room.scenario.productId, organizationId: ctx.organizationId, archivedAt: null },
          select: { id: true },
        })
        if (!product) return 'archived' as const
      }
      const updated = await tx.aishodanRoom.updateMany({
        where: { id: p.id, organizationId: ctx.organizationId }, data,
      })
      return updated.count ? 'updated' as const : 'not-found' as const
    }, { maxWait: 10000, timeout: 30000 })
    if (result === 'not-found') return NextResponse.json({ error: 'ルームが見つかりません' }, { status: 404 })
    if (result === 'archived') return NextResponse.json({ error: '保管済み商材の商談URLは再公開できません。' }, { status: 409 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: '商談URLを更新できませんでした。再試行してください。' }, { status: 503 })
  }
}

export async function DELETE(req: NextRequest, ctxParam: Ctx) {
  const p = await ctxParam.params
  const ctx = await getAishodanContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })
  // ルーム削除は商談ログも道連れになる（onDelete: Cascade）。管理者以上に限る。
  if (!hasMinRole(ctx.role, 'admin')) {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 })
  }
  try {
    const result = await prisma.$transaction(async (tx) => {
      const room = await tx.aishodanRoom.findFirst({
        where: { id: p.id, organizationId: ctx.organizationId },
        select: { id: true, _count: { select: { sessions: true } } },
      })
      if (!room) return 'not-found' as const
      if (room._count.sessions > 0) return 'has-sessions' as const
      await tx.aishodanRoom.delete({ where: { id: room.id } })
      return 'deleted' as const
    }, { isolationLevel: 'Serializable', maxWait: 10000, timeout: 30000 })
    if (result === 'not-found') return NextResponse.json({ error: 'ルームが見つかりません' }, { status: 404 })
    if (result === 'has-sessions') return NextResponse.json({ error: '商談記録があるURLは削除できません。公開を停止して記録を保管してください。' }, { status: 409 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: '削除できませんでした。商談の状況をご確認のうえ再試行してください。' }, { status: 503 })
  }
}
