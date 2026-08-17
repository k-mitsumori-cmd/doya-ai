export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// PATCH  /api/aishodan/rooms/[id] — 公開の停止・再開、上限の変更
// DELETE /api/aishodan/rooms/[id] — ルーム削除
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAishodanContext, hasMinRole, orgSlugFrom } from '@/lib/aishodan/access'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

export async function PATCH(req: NextRequest, ctxParam: Ctx) {
  const p = 'then' in ctxParam.params ? await ctxParam.params : ctxParam.params
  const ctx = await getAishodanContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })
  // ⚠️ 公開停止・上限変更は配布済みURLの挙動を変える（見込み客が商談に入れなくなる）。
  //    同じルームの DELETE が admin 以上なのに PATCH だけ member でも通る状態だった。
  if (!hasMinRole(ctx.role, 'manager')) {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const data: Record<string, unknown> = {}
  if ('isActive' in body) data.isActive = Boolean(body.isActive)
  if ('name' in body && String(body.name).trim()) data.name = String(body.name).trim().slice(0, 200)
  if (Number.isFinite(Number(body?.maxSessions))) {
    data.maxSessions = Math.max(1, Math.min(5000, Math.round(Number(body.maxSessions))))
  }
  if ('expiresInDays' in body) {
    const d = Number(body.expiresInDays)
    data.expiresAt = Number.isFinite(d) && d > 0 ? new Date(Date.now() + d * 24 * 60 * 60 * 1000) : null
  }

  const updated = await prisma.aishodanRoom.updateMany({
    where: { id: p.id, organizationId: ctx.organizationId },
    data,
  })
  if (updated.count === 0) return NextResponse.json({ error: 'ルームが見つかりません' }, { status: 404 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, ctxParam: Ctx) {
  const p = 'then' in ctxParam.params ? await ctxParam.params : ctxParam.params
  const ctx = await getAishodanContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })
  // ルーム削除は商談ログも道連れになる（onDelete: Cascade）。管理者以上に限る
  if (!hasMinRole(ctx.role, 'admin')) {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 })
  }
  const deleted = await prisma.aishodanRoom.deleteMany({
    where: { id: p.id, organizationId: ctx.organizationId },
  })
  if (deleted.count === 0) return NextResponse.json({ error: 'ルームが見つかりません' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
