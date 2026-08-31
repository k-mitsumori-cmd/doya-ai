export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// POST /api/mensetsu/live/[token]/end — 面接終了
// 面接が終わったら、その場で評価まで走らせる。
// ⚠️ 以前は completed で止め、担当者が一覧から「評価する」を押す必要があった。
//    押し忘れると結果が出ないまま放置されるため、自動で最後まで進める（2026-08-31）。
//    評価は数十秒かかるが、応募者のレスポンスは待たせない（awaitしない）。
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { runEvaluation } from '@/lib/mensetsu/run-evaluation'
import { loadSessionByToken } from '@/lib/mensetsu/public'

type Ctx = { params: Promise<{ token: string }> | { token: string } }

export async function POST(_req: NextRequest, ctx: Ctx) {
  const p = 'then' in ctx.params ? await ctx.params : ctx.params
  const s = await loadSessionByToken(p.token)
  if (!s) return NextResponse.json({ error: '面接が見つかりません' }, { status: 404 })
  if (s.status === 'evaluated' || s.status === 'completed') {
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

  const turns = await prisma.mensetsuTurn.count({ where: { sessionId: s.id } })
  const next = turns > 0 ? 'completed' : 'aborted'

  await prisma.mensetsuSession.update({
    where: { id: s.id },
    data: { status: next, endedAt: new Date() },
  })

  // 発話があるものだけ評価する。中断（aborted）は評価しない
  if (next === 'completed') {
    // ⚠️ await しない。応募者の画面はここで返さないと終了操作が固まる。
    //    失敗しても面接は completed のまま残り、担当者が一覧から手で評価できる。
    void runEvaluation(s.id).catch((e) => {
      console.error('[mensetsu] 自動評価に失敗', s.id, e instanceof Error ? e.message : e)
    })
  }

  return NextResponse.json({ ok: true, status: next })
}
