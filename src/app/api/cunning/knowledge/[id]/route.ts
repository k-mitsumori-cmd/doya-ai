export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/cunning/access'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

// GET /api/cunning/knowledge/[id] — 詳細（チャンク一覧）
export async function GET(req: NextRequest, ctx: Ctx) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  const p = 'then' in ctx.params ? await ctx.params : ctx.params
  const base = await prisma.cunningKnowledgeBase.findUnique({
    where: { id: p.id },
    include: {
      chunks: {
        orderBy: { createdAt: 'asc' },
        select: { id: true, content: true, sourceUrl: true, sourceLabel: true, createdAt: true },
      },
    },
  })
  if (!base || base.userId !== userId) return NextResponse.json({ error: '見つかりません' }, { status: 404 })
  return NextResponse.json({ base }, { headers: { 'Cache-Control': 'no-store' } })
}

// DELETE /api/cunning/knowledge/[id]            … ナレッジ全体を削除
// DELETE /api/cunning/knowledge/[id]?chunkId=xx … チャンク1件のみ削除
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  const p = 'then' in ctx.params ? await ctx.params : ctx.params
  const base = await prisma.cunningKnowledgeBase.findUnique({ where: { id: p.id }, select: { userId: true } })
  if (!base || base.userId !== userId) return NextResponse.json({ error: '見つかりません' }, { status: 404 })

  const chunkId = new URL(req.url).searchParams.get('chunkId')
  if (chunkId) {
    // 所有ナレッジ配下のチャンクのみ削除（他人のチャンクIDを渡されても消えない）
    await prisma.cunningKnowledgeChunk.deleteMany({ where: { id: chunkId, knowledgeBaseId: p.id } })
    return NextResponse.json({ ok: true })
  }

  await prisma.cunningKnowledgeBase.delete({ where: { id: p.id } })
  return NextResponse.json({ ok: true })
}
