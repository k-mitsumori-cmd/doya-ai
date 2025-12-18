import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  const id = ctx.params.id
  const article = await prisma.seoArticle.findUnique({ where: { id } })
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


