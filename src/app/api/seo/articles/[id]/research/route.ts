import { prisma } from '@/lib/prisma'
import { getSeoArticleOwner } from '@/lib/seoArticleOwner'
import { NextRequest, NextResponse } from 'next/server'
import { researchAndStore } from '@seo/lib/pipeline'
import { ensureSeoSchema } from '@seo/lib/bootstrap'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params
  const id = params.id
  
  try {
    const owner = await getSeoArticleOwner(_req)
    if (!owner) return NextResponse.json({ success: false, error: 'ログインが必要です' }, { status: 401 })
    await ensureSeoSchema()
    const article = await prisma.seoArticle.findFirst({ where: { id, ...owner }, select: { id: true } })
    if (!article) return NextResponse.json({ success: false, error: 'not found' }, { status: 404 })
    const result = await researchAndStore(id)
    return NextResponse.json({ success: true, ...result })
  } catch (e: any) {
    console.error('[seo research] failed', { articleId: id, error: e?.message || 'unknown error', stack: e?.stack })
    return NextResponse.json(
      { success: false, error: e?.message || '不明なエラー' },
      { status: 500 }
    )
  }
}
