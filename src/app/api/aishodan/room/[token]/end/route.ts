export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// POST /api/aishodan/room/[token]/end — 商談を終了し、要約とフィット判定を作る
//
// ⚠️ 「開始していないセッション」は終了させない。
//    リンクのプレビューやページを開いて閉じただけで商談が死ぬ事故を防ぐ（mensetsu で踏んだ）。
// ⚠️ 中断扱いにするかは、クライアントの申告ではなく**実際の発話数**で決める。
//    離脱ビーコンと明示終了の両方が aborted を送ってくると、
//    まともに実施した商談まで評価不能になる。
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { loadGuestSession } from '@/lib/aishodan/session'
import { deliverPendingCompletionNotifications, deliverPendingFailureNotifications } from '@/lib/aishodan/deliver-completion-notifications'
import { evaluateCurrentSession } from '@/lib/aishodan/evaluate-current-session'
import { enqueueEvaluation } from '@/lib/aishodan/evaluation-task'
import { POST as saveTurns } from '../turn/route'

type Ctx = { params: Promise<{ token: string }> }

/** これ未満の発話数なら、商談が成立したとは見なさない */
const MIN_GUEST_TURNS = 2

export async function POST(req: NextRequest, ctxParam: Ctx) {
  const p = await ctxParam.params
  const body = await req.json().catch(() => ({}))
  const s = await loadGuestSession(req, p.token, String(body?.sessionId || ''))
  if (!s) return NextResponse.json({ error: '商談が見つかりません' }, { status: 404 })

  // 開始していないなら何もしない（プレビューで死なせない）
  if (!s.startedAt) return NextResponse.json({ status: s.status, skipped: true })
  // 離脱通知の発話を保存してから終了を判定する。別要求の到着順に依存しない。
  if (body.turns !== undefined) {
    if (!Array.isArray(body.turns) || body.turns.length > 50) {
      return NextResponse.json({ error: '終了時の発話データが正しくありません。' }, { status: 400 })
    }
    if (body.turns.length > 0) {
      const saved = await saveTurns(new NextRequest(req.url, {
        method: 'POST', headers: req.headers,
        body: JSON.stringify({ sessionId: s.id, turns: body.turns }),
      }), ctxParam)
      if (!saved.ok) return saved
      const result = await saved.json().catch(() => null)
      if (result?.saved !== body.turns.length) {
        return NextResponse.json({ error: '回答の保存を確認できませんでした。保存を再試行してください。' }, { status: 409 })
      }
    }
  }
  const ending = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM aishodan_sessions WHERE id = ${s.id} FOR NO KEY UPDATE`
    const current = await tx.aishodanSession.findUnique({ where: { id: s.id } })
    if (!current || current.organizationId !== s.organizationId || current.roomId !== s.roomId || current.guestId !== s.guestId) {
      return { error: '商談が見つかりません。', status: 404 }
    }
    if (!current.startedAt) return { status: current.status, skipped: true }
    if (!current.consentedAt) return { error: '先に同意が必要です。', status: 403 }
    if (current.purgeAfter && current.purgeAfter.getTime() <= Date.now()) {
      return { error: 'この商談の記録は保存期間が終了しています。', status: 410 }
    }
    if (current.endedAt) return { status: current.status, alreadyEnded: true }
    if (current.status !== 'live') return { error: '商談の状態が変わりました。再読み込みしてご確認ください。', status: 409 }
    const guestTurns = await tx.aishodanTurn.count({ where: { sessionId: s.id, speaker: 'guest' } })
    const status = guestTurns < MIN_GUEST_TURNS ? 'aborted' : 'completed'
    const revision = new Date(Math.max(Date.now(), current.updatedAt.getTime() + 1))
    const claimed = await tx.aishodanSession.updateMany({
      where: { id: current.id, organizationId: s.organizationId, roomId: s.roomId, guestId: s.guestId,
        status: 'live', startedAt: { not: null }, endedAt: null },
      data: { status, endedAt: new Date(), updatedAt: revision },
    })
    if (claimed.count !== 1) return { error: '商談の状態が変わりました。再読み込みしてご確認ください。', status: 409 }
    if (status === 'completed') await enqueueEvaluation(tx, current.id, current.organizationId, revision)
    return { status }
  }, { isolationLevel: 'ReadCommitted', timeout: 15000 })
  if ('error' in ending) return NextResponse.json({ error: ending.error }, { status: ending.status as number })
  if ('alreadyEnded' in ending || 'skipped' in ending || ending.status === 'aborted') {
    return NextResponse.json(ending)
  }

  try {
    const evaluated = await evaluateCurrentSession({ sessionId: s.id, organizationId: s.organizationId, notifyOnCompletion: !s.room.isPreview })
    if (!evaluated.ok) {
      const current = await prisma.aishodanSession.findFirst({
        where: { id: s.id, organizationId: s.organizationId, roomId: s.roomId, guestId: s.guestId },
        select: { status: true },
      })
      if (!current) return NextResponse.json({ error: '商談が見つかりません。' }, { status: 404 })
      return NextResponse.json({ status: current.status, evaluated: false, reason: evaluated.reason })
    }
  } catch (err) {
    // ⚠️ 評価に失敗しても商談ログは残す。completed のまま置き、後から再評価できる状態にする。
    console.error('[aishodan] evaluate failed')
    if (!s.room.isPreview) {
      await deliverPendingFailureNotifications(1, { sessionId: s.id, organizationId: s.organizationId })
        .catch(() => console.error('[aishodan] failure notification remains pending'))
    }
    return NextResponse.json({ status: 'completed', evaluated: false })
  }

  // Delivery acknowledges the same durable intent used by cron recovery.
  if (!s.room.isPreview) {
    await deliverPendingCompletionNotifications(1, { sessionId: s.id, organizationId: s.organizationId })
      .catch(() => console.error('[aishodan] completion notification remains pending'))
  }

  return NextResponse.json({
    status: 'evaluated',
    evaluated: true,
    // ゲスト側に返すのは「終わったこと」だけ。スコアや社内向けの判定理由は返さない
    thanks: true,
  })
}
