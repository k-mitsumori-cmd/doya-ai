export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// DELETE /api/aishodan/products/[id] — 未使用なら削除、商談記録があれば保管
//
// ⚠️ onDelete: Cascade により商談ログも消えるため、記録がある商材は保管する。
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAishodanContext, hasMinRole, orgSlugFrom } from '@/lib/aishodan/access'

type Ctx = { params: Promise<{ id: string }> }

export async function DELETE(req: NextRequest, ctxParam: Ctx) {
  const p = await ctxParam.params
  const ctx = await getAishodanContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })
  if (!hasMinRole(ctx.role, 'admin')) {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 })
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 所属確認・記録数確認・削除を同じトランザクションで行う。
      const product = await tx.aishodanProduct.findFirst({
        where: { id: p.id, organizationId: ctx.organizationId },
        select: { id: true, archivedAt: true },
      })
      if (!product) return 'not-found' as const
      const recentActiveSessions = await tx.aishodanSession.count({
        where: {
          organizationId: ctx.organizationId,
          room: { scenario: { productId: product.id } },
          status: { in: ['pending', 'live'] },
          updatedAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
        },
      })
      if (recentActiveSessions > 0) return 'active-sessions' as const
      const sessions = await tx.aishodanSession.count({
        where: { organizationId: ctx.organizationId, room: { scenario: { productId: product.id } } },
      })
      if (sessions > 0) {
        if (product.archivedAt) return 'archived' as const
        await tx.aishodanProduct.update({ where: { id: product.id }, data: { archivedAt: new Date() } })
        await tx.aishodanRoom.updateMany({
          where: { scenario: { productId: product.id }, organizationId: ctx.organizationId },
          data: { isActive: false },
        })
        return 'archived' as const
      }
      await tx.aishodanProduct.delete({ where: { id: product.id } })
      return 'deleted' as const
    }, { isolationLevel: 'Serializable', maxWait: 10000, timeout: 30000 })
    if (result === 'not-found') return NextResponse.json({ error: '商材が見つかりません' }, { status: 404 })
    if (result === 'active-sessions') return NextResponse.json({ error: '進行中の商談があります。商談の終了後に保管してください。' }, { status: 409 })
    if (result === 'archived') return NextResponse.json({ ok: true, archived: true, deletedSessions: 0 })
    return NextResponse.json({ ok: true, deletedSessions: 0 })
  } catch {
    return NextResponse.json({ error: '削除できませんでした。商談の発行状況を確認してから再試行してください。' }, { status: 503 })
  }
}
