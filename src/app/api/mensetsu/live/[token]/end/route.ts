export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// POST /api/mensetsu/live/[token]/end — 面接終了
// 評価は同期実行せず completed にする（評価は採用担当者側のバッチで走らせる）。
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
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

  return NextResponse.json({ ok: true, status: next })
}
