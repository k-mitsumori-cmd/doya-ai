export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// POST /api/mensetsu/live/[token]/end — 面接終了
// 面接が終わったら、その場で評価まで走らせる。
// ⚠️ 以前は completed で止め、担当者が一覧から「評価する」を押す必要があった。
//    押し忘れると結果が出ないまま放置されるため、自動で最後まで進める（2026-08-31）。
//    評価は数十秒かかるが、応募者のレスポンスは待たせない（awaitしない）。
import { NextRequest, NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { prisma } from '@/lib/prisma'
import { runEvaluation } from '@/lib/mensetsu/run-evaluation'
import { loadSessionByToken } from '@/lib/mensetsu/public'

type Ctx = { params: Promise<{ token: string }> }

export async function POST(_req: NextRequest, ctx: Ctx) {
  const p = await ctx.params
  const s = await loadSessionByToken(p.token)
  if (!s) return NextResponse.json({ error: '面接が見つかりません' }, { status: 404 })
  if (s.status === 'evaluated' || s.status === 'evaluating' || s.status === 'completed') {
    return NextResponse.json({ ok: true, alreadyEnded: true })
  }

  // ⚠️ クライアントの aborted 申告だけで終端状態を決めないこと。
  //    以前は離脱(beacon)・退出ボタンのどちらも aborted:true を送っており、
  //    5問答えた面接でも 'aborted' に落ちて、逐語ログがあるのに
  //    評価も再開もできない状態になっていた（担当者UIもcronも aborted は拾わない）。
  //    close ルートと cron に合わせ、**発話が残っていれば completed** に倒す。
  // ⚠️ 一度も開始していない面接を終了扱いにしないこと。
  //    リンクを開いて閉じただけで面接が死に、応募者が二度と受けられなくなる。
  if (!s.startedAt) {
    return NextResponse.json({ ok: true, skipped: 'not_started' })
  }

  const ended = await prisma.$transaction(async (tx) => {
    // 発話追加と同じ行をロックし、最新の発話件数で終了状態を決める。
    await tx.$queryRaw`SELECT id FROM mensetsu_sessions WHERE id = ${s.id} FOR NO KEY UPDATE`
    const current = await tx.mensetsuSession.findUnique({ where: { id: s.id } })
    if (!current || !current.startedAt || current.endedAt || !['live', 'consented'].includes(current.status)) return null
    const turns = await tx.mensetsuTurn.count({ where: { sessionId: s.id } })
    const next = turns > 0 ? 'completed' : 'aborted'
    const updated = await tx.mensetsuSession.updateMany({
      where: { id: s.id, status: current.status, startedAt: { not: null }, endedAt: null },
      data: { status: next, endedAt: new Date() },
    })
    return updated.count === 1 ? next : null
  }, { isolationLevel: 'ReadCommitted', timeout: 15000 })
  if (!ended) return NextResponse.json({ ok: true, alreadyEnded: true })

  // 発話があるものだけ評価する。中断（aborted）は評価しない
  if (ended === 'completed') {
    // 応募者にはすぐ応答しつつ、レスポンス後も自動評価を実行し続ける。
    // 失敗時は completed のまま残り、担当者が一覧から再試行できる。
    const evaluation = runEvaluation(s.id).then((result) => {
      if (!result.ok) {
        if (result.status === 409) console.warn('[mensetsu] 自動評価は状態の変更で確定しませんでした', result.status)
        else console.error('[mensetsu] 自動評価を完了できませんでした', result.status)
      }
    }).catch(() => {
      console.error('[mensetsu] 自動評価に失敗')
    })
    try { waitUntil(evaluation) } catch { await evaluation }
  }

  return NextResponse.json({ ok: true, status: ended })
}
