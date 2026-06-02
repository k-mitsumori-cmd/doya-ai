export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/cunning/access'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

async function ownedSession(userId: string, id: string) {
  const s = await prisma.cunningSession.findUnique({ where: { id } })
  if (!s || s.userId !== userId) return null
  return s
}

// GET /api/cunning/sessions/[id] — 詳細（文字起こし・回答履歴）
export async function GET(req: NextRequest, ctx: Ctx) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  const p = 'then' in ctx.params ? await ctx.params : ctx.params

  const session = await prisma.cunningSession.findUnique({
    where: { id: p.id },
    include: {
      transcripts: { orderBy: { createdAt: 'asc' }, take: 500 },
      answers: { orderBy: { createdAt: 'asc' }, take: 200 },
    },
  })
  if (!session || session.userId !== userId) {
    return NextResponse.json({ error: '見つかりません' }, { status: 404 })
  }
  return NextResponse.json({ session }, { headers: { 'Cache-Control': 'no-store' } })
}

// PATCH /api/cunning/sessions/[id] — 利用時間の加算 / 終了
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  const p = 'then' in ctx.params ? await ctx.params : ctx.params
  const s = await ownedSession(userId, p.id)
  if (!s) return NextResponse.json({ error: '見つかりません' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  const data: any = {}
  // 経過秒の加算（クライアントが定期送信）。負値や巨大値は無視。
  if (typeof body.addSeconds === 'number' && body.addSeconds > 0 && body.addSeconds < 3600) {
    data.durationSec = { increment: Math.round(body.addSeconds) }
  }
  if (body.end === true) {
    data.status = 'ended'
    data.endedAt = new Date()
  }
  if (body.title && typeof body.title === 'string') data.title = body.title.trim().slice(0, 120)

  const updated = await prisma.cunningSession.update({ where: { id: p.id }, data })
  return NextResponse.json({ session: updated })
}

// DELETE /api/cunning/sessions/[id]
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  const p = 'then' in ctx.params ? await ctx.params : ctx.params
  const s = await ownedSession(userId, p.id)
  if (!s) return NextResponse.json({ error: '見つかりません' }, { status: 404 })
  await prisma.cunningSession.delete({ where: { id: p.id } })
  return NextResponse.json({ ok: true })
}
