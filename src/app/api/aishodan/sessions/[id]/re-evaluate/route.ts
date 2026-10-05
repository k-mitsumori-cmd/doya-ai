export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// POST /api/aishodan/sessions/[id]/re-evaluate — 適合判定をやり直す
//
// ⚠️ 判定の生成は商談終了時の1回きりで、失敗すると AishodanOutcome が作られない。
//    モデルIDの世代交代・JSONパース失敗は実際に起きており、そのたびに
//    **本物の見込み客の商談が、判定不能のまま一覧で放置**されていた。
//    終了処理そのものは冪等ではない（endedAt があると早期リターンする）ため、
//    もう一度 /end を叩いても判定は作り直せない。やり直す入口をここに置く。
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAishodanContext, hasMinRole, orgSlugFrom } from '@/lib/aishodan/access'
import { evaluateCurrentSession } from '@/lib/aishodan/evaluate-current-session'

type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, ctxParam: Ctx) {
  const p = await ctxParam.params
  const ctx = await getAishodanContext(orgSlugFrom(req))
  if (!ctx) return NextResponse.json({ error: '組織が見つかりません' }, { status: 401 })
  // 判定は営業の意思決定に使う。やり直しはマネージャー以上に限る
  if (!hasMinRole(ctx.role, 'manager')) {
    return NextResponse.json({ error: '再評価する権限がありません' }, { status: 403 })
  }

  // ⚠️ id だけで他組織の商談に到達させない（二重条件）
  const s = await prisma.aishodanSession.findFirst({
    where: { id: p.id, organizationId: ctx.organizationId },
    include: {
      outcome: { select: { id: true, overriddenAt: true } },
      room: { include: { scenario: { include: { product: { select: { name: true } } } } } },
    },
  })
  if (!s) return NextResponse.json({ error: '商談が見つかりません' }, { status: 404 })
  if (!s.startedAt) {
    return NextResponse.json({ error: 'この商談はまだ実施されていません。' }, { status: 400 })
  }
  if (!s.endedAt || !['completed', 'evaluated'].includes(s.status)) {
    return NextResponse.json({ error: '自動判定は商談が終了してから実行してください。' }, { status: 409 })
  }
  // ⚠️ 人が手で直した判定をAIで上書きしない。上書きするなら明示的に指示させる。
  const body = await req.json().catch(() => ({}))
  if (s.outcome?.overriddenAt) {
    if (body?.overwriteManual !== true) {
      return NextResponse.json(
        { error: 'この商談の判定は担当者が手で入力しています。上書きする場合は再度お確かめください。', needsConfirm: true },
        { status: 409 }
      )
    }
  }

  try {
    const evaluated = await evaluateCurrentSession({
      sessionId: s.id, organizationId: ctx.organizationId,
      expectedUpdatedAt: s.updatedAt, retryOnChange: false,
      manualReplacement: { approved: body?.overwriteManual === true, overriddenAt: s.outcome?.overriddenAt ?? null },
    })
    if (!evaluated.ok) {
      return NextResponse.json({ error: '判定を確定できませんでした。実行中の処理や最新の商談記録をご確認のうえ、再度お試しください。', reason: evaluated.reason },
        { status: evaluated.reason === 'empty_transcript' ? 400 : 409 })
    }
    return NextResponse.json({ outcome: evaluated.outcome })
  } catch {
    console.error('[aishodan] re-evaluate failed')
    return NextResponse.json({ error: '判定を作成できませんでした。時間をおいて再度お試しいただくか、判定を手で入力してください。' }, { status: 502 })
  }
}
