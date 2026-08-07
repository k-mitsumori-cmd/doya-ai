export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// POST /api/mensetsu/sessions/[id]/close — 実施中の面接を担当者が強制終了する
//
// なぜ必要か:
//   応募者がタブを閉じたり通信が切れたりすると、セッションが status='live' のまま残る。
//   pagehide + sendBeacon で大半は拾えるが、ブラウザのクラッシュや強制終了までは拾えない。
//   その1件が残るとテンプレートの質問編集が 409 で永久にブロックされるため、
//   担当者が自分で閉じられる出口を必ず用意しておく。
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMensetsuContext, hasMinRole, orgSlugFrom } from '@/lib/mensetsu/access'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

export async function POST(req: NextRequest, ctx: Ctx) {
  const p = 'then' in ctx.params ? await ctx.params : ctx.params
  const c = await getMensetsuContext(orgSlugFrom(req))
  if (!c) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })
  if (!hasMinRole(c.role, 'manager')) {
    return NextResponse.json({ error: '操作する権限がありません' }, { status: 403 })
  }

  // id だけで他組織の面接に到達させない（二重条件）
  const s = await prisma.mensetsuSession.findFirst({
    where: { id: p.id, organizationId: c.organizationId },
    select: { id: true, status: true, _count: { select: { turns: true } } },
  })
  if (!s) return NextResponse.json({ error: '見つかりません' }, { status: 404 })
  if (!['pending', 'consented', 'live'].includes(s.status)) {
    return NextResponse.json({ error: 'この面接は既に終了しています' }, { status: 409 })
  }

  // 発話が残っていれば評価に回せるので completed、無ければ aborted にする。
  // 一律 aborted にすると、途中まで話した面接を評価できなくなる。
  const next = s._count.turns > 0 ? 'completed' : 'aborted'
  await prisma.mensetsuSession.update({
    where: { id: s.id },
    data: { status: next, endedAt: new Date() },
  })
  return NextResponse.json({ ok: true, status: next })
}
