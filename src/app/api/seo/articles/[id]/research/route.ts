import { prisma } from '@/lib/prisma'
import { getSeoGenerationOwner } from '@/lib/seoArticleOwner'
import { NextRequest, NextResponse } from 'next/server'
import { researchAndStore } from '@seo/lib/pipeline'
import { ensureSeoSchema } from '@seo/lib/bootstrap'
import { reserveSeoToolCall, SeoToolRateLimitError } from '@/lib/seo-tool-admission'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params
  const id = params.id
  
  try {
    const owner = await getSeoGenerationOwner(_req)
    if (!owner) return NextResponse.json({ success: false, error: 'ログインが必要です' }, { status: 401 })
    await ensureSeoSchema()
    const article = await prisma.seoArticle.findFirst({ where: { id, ...owner }, select: { id: true } })
    if (!article) return NextResponse.json({ success: false, error: 'not found' }, { status: 404 })
    await reserveSeoToolCall(owner.userId, 'article-text-tools')
    const result = await researchAndStore(id)
    return NextResponse.json({ success: true, ...result })
  } catch (e: any) {
    if (e instanceof SeoToolRateLimitError) return NextResponse.json({ success: false, code: 'SEO_TEXT_DAILY_LIMIT', error: `本日のAI編集の運用上限（${e.limit}回）に達しました。明日お試しください。` }, { status: 429 })
    console.error('[seo research] failed')
    return NextResponse.json(
      { success: false, error: '記事の調査に失敗しました。時間をおいて再試行してください。' },
      { status: 500 }
    )
  }
}
