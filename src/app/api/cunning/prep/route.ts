export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/cunning/access'
import { generatePrep } from '@/lib/cunning/prep'
import { resolveSessionContext } from '@/lib/cunning/context'
import type { KnowledgeChunkLite } from '@/lib/cunning/types'

// POST /api/cunning/prep — セッションのコンテキストから想定問答を生成
// body: { sessionId }
export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId()
    if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const sessionId = body.sessionId as string | undefined
    if (!sessionId) return NextResponse.json({ error: 'sessionIdが必要です' }, { status: 400 })

    const ctx = await resolveSessionContext(userId, sessionId)
    if (!ctx) return NextResponse.json({ error: 'セッションが見つかりません' }, { status: 404 })

    let chunks: KnowledgeChunkLite[] | undefined
    if (ctx.knowledgeBaseId) {
      // 事前準備は全体傾向を見るため、先頭の代表チャンクを多めに渡す
      chunks = await prisma.cunningKnowledgeChunk.findMany({
        where: { knowledgeBaseId: ctx.knowledgeBaseId },
        select: { id: true, content: true, sourceUrl: true, sourceLabel: true },
        take: 10,
      })
    }

    const items = await generatePrep({
      mode: ctx.mode,
      chunks,
      company: ctx.company,
      applicant: ctx.applicant,
      count: body.count,
    })
    return NextResponse.json({ items }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e: any) {
    console.error('[cunning/prep]', e?.message)
    return NextResponse.json({ error: '想定問答の生成に失敗しました' }, { status: 500 })
  }
}
