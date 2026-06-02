export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getUserId } from '@/lib/cunning/access'
import { chunkText } from '@/lib/cunning/rag'
import { scrapeUrl } from '@/lib/cunning/scraper'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

// POST /api/cunning/knowledge/[id]/ingest — テキスト/URLを取り込み（チャンク化して保存）
// body: { type: 'text'|'url', text?: string, url?: string, label?: string }
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const userId = await getUserId()
    if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    const p = 'then' in ctx.params ? await ctx.params : ctx.params

    const base = await prisma.cunningKnowledgeBase.findUnique({
      where: { id: p.id },
      select: { userId: true },
    })
    if (!base || base.userId !== userId) return NextResponse.json({ error: '見つかりません' }, { status: 404 })

    const body = await req.json().catch(() => ({}))
    const type = body.type === 'url' ? 'url' : 'text'

    let rawText = ''
    let sourceUrl: string | null = null
    let sourceLabel: string = (body.label as string)?.slice(0, 120) || ''

    if (type === 'url') {
      const url = (body.url as string)?.trim()
      if (!url) return NextResponse.json({ error: 'URLを入力してください' }, { status: 400 })
      const scraped = await scrapeUrl(url)
      rawText = scraped.text
      sourceUrl = scraped.url
      sourceLabel = sourceLabel || scraped.title
    } else {
      rawText = (body.text as string)?.trim() || ''
      if (!rawText) return NextResponse.json({ error: 'テキストを入力してください' }, { status: 400 })
      sourceLabel = sourceLabel || '手入力テキスト'
    }

    const chunks = chunkText(rawText)
    if (chunks.length === 0) {
      return NextResponse.json({ error: '取り込めるテキストがありませんでした' }, { status: 400 })
    }

    await prisma.cunningKnowledgeChunk.createMany({
      data: chunks.map((content) => ({
        knowledgeBaseId: p.id,
        content,
        sourceUrl,
        sourceLabel,
      })),
    })
    await prisma.cunningKnowledgeBase.update({ where: { id: p.id }, data: { updatedAt: new Date() } })

    return NextResponse.json({ added: chunks.length })
  } catch (e: any) {
    console.error('[cunning/ingest]', e?.message)
    return NextResponse.json({ error: '取り込みに失敗しました' }, { status: 500 })
  }
}
