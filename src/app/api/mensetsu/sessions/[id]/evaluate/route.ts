export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// POST /api/mensetsu/sessions/[id]/evaluate — 面接後の評価バッチ（F2）
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMensetsuContext, orgSlugFrom } from '@/lib/mensetsu/access'
import { runEvaluation } from '@/lib/mensetsu/run-evaluation'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

export async function POST(req: NextRequest, ctx: Ctx) {
  const p = 'then' in ctx.params ? await ctx.params : ctx.params
  const c = await getMensetsuContext(orgSlugFrom(req))
  if (!c) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })

  // 他組織の面接を評価させない（二重条件）
  const owned = await prisma.mensetsuSession.findFirst({
    where: { id: p.id, organizationId: c.organizationId },
    select: { id: true },
  })
  if (!owned) return NextResponse.json({ error: '見つかりません' }, { status: 404 })

  try {
    // ⚠️ 自動評価（面接終了時）と同じ処理を通す。分けて書くと結果が食い違う
    const r = await runEvaluation(owned.id)
    if (!r.ok) return NextResponse.json({ error: r.reason }, { status: r.status })
    return NextResponse.json({ ok: true, verdict: r.verdict })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || '評価に失敗しました' }, { status: 502 })
  }
}
