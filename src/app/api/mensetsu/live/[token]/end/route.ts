export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// POST /api/mensetsu/live/[token]/end — 面接終了
// 評価は同期実行せず completed にする（評価は採用担当者側のバッチで走らせる）。
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { loadSessionByToken } from '@/lib/mensetsu/public'

type Ctx = { params: Promise<{ token: string }> | { token: string } }

export async function POST(req: NextRequest, ctx: Ctx) {
  const p = 'then' in ctx.params ? await ctx.params : ctx.params
  const s = await loadSessionByToken(p.token)
  if (!s) return NextResponse.json({ error: '面接が見つかりません' }, { status: 404 })
  if (s.status === 'evaluated' || s.status === 'completed') {
    return NextResponse.json({ ok: true, alreadyEnded: true })
  }

  const body = await req.json().catch(() => ({}))
  const aborted = body?.aborted === true

  await prisma.mensetsuSession.update({
    where: { id: s.id },
    data: { status: aborted ? 'aborted' : 'completed', endedAt: new Date() },
  })

  return NextResponse.json({ ok: true })
}
