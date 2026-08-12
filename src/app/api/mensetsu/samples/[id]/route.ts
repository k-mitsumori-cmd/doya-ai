export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// DELETE /api/mensetsu/samples/[id] — 採点例を取り消す
// ⚠️ 誤ってラベルを付けると以後の全ての採点が歪む。取り消せることが必須。
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMensetsuContext, hasMinRole, orgSlugFrom } from '@/lib/mensetsu/access'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

export async function DELETE(req: NextRequest, ctxParam: Ctx) {
  const p = 'then' in ctxParam.params ? await ctxParam.params : ctxParam.params
  const ctx = await getMensetsuContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })
  if (!hasMinRole(ctx.role, 'manager')) {
    return NextResponse.json({ error: '権限がありません' }, { status: 403 })
  }

  // id だけで他組織の採点例に到達させない（二重条件）
  const deleted = await prisma.mensetsuAnswerSample.deleteMany({
    where: { id: p.id, organizationId: ctx.organizationId },
  })
  if (deleted.count === 0) return NextResponse.json({ error: '見つかりません' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
