export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// DELETE /api/aishodan/products/[id] — 商材（取り込んだサービス）を削除
//
// ⚠️ **道連れが大きい。** onDelete: Cascade により
//    ナレッジ・取り込みページ・シナリオ・商談URL・**実施済みの商談ログ**まで消える。
//    復旧手段は無いので、管理者以上に限り、件数を返して画面で必ず確認させる。
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAishodanContext, hasMinRole, orgSlugFrom } from '@/lib/aishodan/access'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

export async function DELETE(req: NextRequest, ctxParam: Ctx) {
  const p = 'then' in ctxParam.params ? await ctxParam.params : ctxParam.params
  const ctx = await getAishodanContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })
  if (!hasMinRole(ctx.role, 'admin')) {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 })
  }

  // ⚠️ id だけで引かない。必ず所有者条件と併用する（他組織の商材を消させない）
  const product = await prisma.aishodanProduct.findFirst({
    where: { id: p.id, organizationId: ctx.organizationId },
    select: { id: true },
  })
  if (!product) return NextResponse.json({ error: '商材が見つかりません' }, { status: 404 })

  // 何が道連れになるかを数えてから消す（画面に出して納得してもらうため）
  const sessions = await prisma.aishodanSession.count({
    where: { room: { scenario: { productId: product.id } } },
  })

  await prisma.aishodanProduct.delete({ where: { id: product.id } })
  return NextResponse.json({ ok: true, deletedSessions: sessions })
}
