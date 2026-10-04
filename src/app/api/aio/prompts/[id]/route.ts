export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAioContext, hasMinRole, orgSlugFrom } from '@/lib/aio/access'

type Ctx = { params: Promise<{ id: string }> }

// PATCH /api/aio/prompts/[id] — 編集/有効切替（manager+）
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const p = await ctx.params
  const sctx = await getAioContext(orgSlugFrom(req))
  if (!sctx) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 })
  if (!hasMinRole(sctx.role, 'manager')) return NextResponse.json({ error: '編集権限がありません' }, { status: 403 })

  // organizationId + id の二重検索（IDOR防止）
  const target = await prisma.aioPrompt.findFirst({ where: { id: p.id, organizationId: sctx.organizationId, archivedAt: null } })
  if (!target) return NextResponse.json({ error: 'プロンプトが見つかりません' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const data: Record<string, any> = {}
  if (typeof body.text === 'string' && body.text.trim()) data.text = body.text.trim().slice(0, 500)
  if (typeof body.isActive === 'boolean') data.isActive = body.isActive
  if (typeof body.category === 'string') data.category = body.category.trim().slice(0, 80) || null

  const updated = await prisma.aioPrompt.updateMany({ where: { id: target.id, organizationId: sctx.organizationId, archivedAt: null }, data })
  if (updated.count !== 1) return NextResponse.json({ error: 'プロンプトが見つかりません' }, { status: 404 })
  const prompt = await prisma.aioPrompt.findUnique({ where: { id: target.id } })
  return NextResponse.json({ ok: true, prompt })
}

// DELETE /api/aio/prompts/[id]（manager+）— 測定履歴の参照元を残して保管
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const p = await ctx.params
  const sctx = await getAioContext(orgSlugFrom(req))
  if (!sctx) return NextResponse.json({ error: 'ログイン/組織が必要です' }, { status: 401 })
  if (!hasMinRole(sctx.role, 'manager')) return NextResponse.json({ error: '編集権限がありません' }, { status: 403 })

  const result = await prisma.$transaction(async (tx) => {
    // POST と同じ組織ロックで枠の解放と新規登録を直列化する。
    await tx.$queryRaw`SELECT id FROM aio_organizations WHERE id = ${sctx.organizationId} FOR NO KEY UPDATE`
    const archived = await tx.aioPrompt.updateMany({
      where: { id: p.id, organizationId: sctx.organizationId, archivedAt: null },
      data: { archivedAt: new Date(), isActive: false },
    })
    return archived.count === 1
  })
  if (!result) return NextResponse.json({ error: 'プロンプトが見つかりません' }, { status: 404 })
  return NextResponse.json({ ok: true, archived: true })
}
