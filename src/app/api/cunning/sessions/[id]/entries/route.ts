export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { readCunningTranscripts } from '@/lib/cunning/history-read'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/cunning/access'
import { decodeCunningTranscriptCursor, encodeCunningTranscriptCursor, decodeCunningCursor, encodeCunningCursor } from '@/lib/cunning/history-cursor'

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const userId = await getUserId()
  if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
  const { id } = await ctx.params
  const params = new URL(req.url).searchParams
  const kind = params.get('kind')
  if (kind !== 'transcripts' && kind !== 'answers') return NextResponse.json({ error: '履歴の種類が不正です' }, { status: 400 })
  let transcriptCursor: ReturnType<typeof decodeCunningTranscriptCursor> | null = null
  let cursor: ReturnType<typeof decodeCunningCursor> | null = null
  try {
    if (params.has('cursor')) {
      if (kind === 'transcripts') transcriptCursor = decodeCunningTranscriptCursor(params.get('cursor')!)
      else cursor = decodeCunningCursor(params.get('cursor')!)
    }
  } catch { return NextResponse.json({ error: '続きの取得位置が不正です。履歴を読み直してください。' }, { status: 400 }) }
  return prisma.$transaction(async tx => {
    if (!await tx.user.findUnique({ where: { id: userId }, select: { id: true } })) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    const session = await tx.cunningSession.findUnique({ where: { id }, select: { userId: true, status: true, updatedAt: true } })
    if (!session || session.userId !== userId || session.status === 'deleted') return NextResponse.json({ error: '見つかりません' }, { status: 404 })
    if (transcriptCursor && (transcriptCursor.sessionId !== id || +transcriptCursor.revision !== +session.updatedAt)) {
      return NextResponse.json({ error: '履歴が更新されました。最新の発話順で履歴を読み直してください。', code: 'HISTORY_CHANGED' }, { status: 409, headers: { 'Cache-Control': 'no-store' } })
    }
    const where = { sessionId: id, ...(cursor ? { OR: [
      { createdAt: { gt: cursor.createdAt } }, { createdAt: cursor.createdAt, id: { gt: cursor.id } },
    ] } : {}) }
    if (kind === 'transcripts') {
      const rows = await readCunningTranscripts(tx, userId, id, 101, transcriptCursor)
      return NextResponse.json({ kind, items: rows.slice(0, 100), nextCursor: rows.length > 100 ? encodeCunningTranscriptCursor(rows[99], id, session.updatedAt) : null }, { headers: { 'Cache-Control': 'no-store' } })
    }
    const rows = await tx.cunningAnswer.findMany({ where, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: 101 })
    return NextResponse.json({ kind, items: rows.slice(0, 100), nextCursor: rows.length > 100 ? encodeCunningCursor(rows[99]) : null }, { headers: { 'Cache-Control': 'no-store' } })
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead })
}
