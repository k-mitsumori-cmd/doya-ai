import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureSeoSchema } from '@seo/lib/bootstrap'

export const runtime = 'nodejs'

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> | { id: string } }) {
  await ensureSeoSchema()
  const params = 'then' in ctx.params ? await ctx.params : ctx.params
  const id = params.id
  const article = await (prisma as any).seoArticle.findUnique({ where: { id } })
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
