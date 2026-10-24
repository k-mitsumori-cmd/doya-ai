export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// POST /api/mensetsu/sessions/[id]/evaluate — 面接後の評価バッチ（F2）
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getMensetsuContext, orgSlugFrom } from '@/lib/mensetsu/access'
import { runEvaluation } from '@/lib/mensetsu/run-evaluation'
import { withDoyaPowerCharge } from '@/lib/doya-power/charge'

/** ドヤパワーの包みに「AI を呼んだあとの失敗なので戻さない」と伝える印（統合のとき DOYA_POWER_CONSUMED_HEADER の定数へそろえる） */
const CONSUMED = { 'x-doya-power-consumed': '1' }
/** 手動の評価のやり直しを同じ面接に続けて行える間隔。AI の乱用防止（スキーマを変えず evaluatedAt で判定） */
const REEVALUATE_COOLDOWN_MS = 5 * 60 * 1000

type Ctx = { params: Promise<{ id: string }> }

async function postHandler(req: NextRequest, ctx: Ctx) {
  const p = await ctx.params
  const c = await getMensetsuContext(orgSlugFrom(req))
  if (!c) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })

  // 他組織の面接を評価させない（二重条件）
  const owned = await prisma.mensetsuSession.findFirst({
    where: { id: p.id, organizationId: c.organizationId },
    select: { id: true, status: true, evaluatedAt: true },
  })
  if (!owned) return NextResponse.json({ error: '見つかりません' }, { status: 404 })

  // 評価済みの面接を続けてやり直せる回数を絞る（AI を呼ぶ前に断る。ドヤパワーは戻る）
  if (owned.status === 'evaluated' && owned.evaluatedAt) {
    const waitMs = owned.evaluatedAt.getTime() + REEVALUATE_COOLDOWN_MS - Date.now()
    if (waitMs > 0) {
      return NextResponse.json(
        { error: `評価をやり直せるのは、前回の評価から5分あけたあとです。あと${Math.ceil(waitMs / 60000)}分ほどお待ちください。` },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(waitMs / 1000)) } },
      )
    }
  }

  try {
    // ⚠️ 自動評価（面接終了時）と同じ処理を通す。分けて書くと結果が食い違う
    const r = await runEvaluation(owned.id)
    if (!r.ok) return NextResponse.json({ error: r.reason }, { status: r.status, headers: r.aiCalled ? CONSUMED : undefined })
    return NextResponse.json({ ok: true, verdict: r.verdict })
  } catch (e: any) {
    console.error('[mensetsu/sessions/[id]/evaluate] unexpected error')
    return NextResponse.json({ error: '評価に失敗しました' }, { status: 502, headers: CONSUMED })
  }
}

// ドヤパワー（旗 DOYA_POWER_ROLLOUT の内側だけ）: AI を呼ぶ前に減らし、失敗なら戻す。足りないときは 402 と日本語の理由（src/lib/doya-power/charge.ts）
export const POST = withDoyaPowerCharge({ action: 'text.generate' }, postHandler)
