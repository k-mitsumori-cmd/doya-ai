import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSeoArticleOwner } from '@/lib/seoArticleOwner'
import { ensureSeoSchema } from '@seo/lib/bootstrap'

export const runtime = 'nodejs'

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const owner = await getSeoArticleOwner(_req)
  if (!owner) return NextResponse.json({ success: false, error: 'ログインが必要です' }, { status: 401 })
  await ensureSeoSchema()
  const params = await ctx.params
  const id = params.id
  const article = await (prisma as any).seoArticle.findFirst({ where: { id, ...owner } })
  if (!article) return NextResponse.json({ success: false, error: 'not found' }, { status: 404 })
  const md = article.finalMarkdown || article.outline || ''

  const filename = `doya-article-${id}.md`
  return new NextResponse(md, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
