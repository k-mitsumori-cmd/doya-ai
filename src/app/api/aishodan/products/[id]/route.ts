export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// DELETE /api/aishodan/products/[id] — 商材（取り込んだサービス）を削除
//
// ⚠️ onDelete: Cascade により商談ログも消えるため、記録がある商材は削除しない。
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
        select: { id: true },
      })
      if (!product) return 'not-found' as const
      const sessions = await tx.aishodanSession.count({
        where: { organizationId: ctx.organizationId, room: { scenario: { productId: product.id } } },
      })
      if (sessions > 0) return 'has-sessions' as const
      await tx.aishodanProduct.delete({ where: { id: product.id } })
      return 'deleted' as const
    }, { isolationLevel: 'Serializable', maxWait: 10000, timeout: 30000 })
    if (result === 'not-found') return NextResponse.json({ error: '商材が見つかりません' }, { status: 404 })
    if (result === 'has-sessions') return NextResponse.json({ error: '商談記録がある商材は削除できません。商材を編集してご利用ください。' }, { status: 409 })
    return NextResponse.json({ ok: true, deletedSessions: 0 })
  } catch {
    return NextResponse.json({ error: '削除できませんでした。商談の発行状況を確認してから再試行してください。' }, { status: 503 })
  }
}
