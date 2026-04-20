import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureSeoSchema } from '@seo/lib/bootstrap'

export const runtime = 'nodejs'

function markdownToPlainText(md: string): string {
  let s = String(md || '')
  s = s.replace(/<!--[\s\S]*?-->/g, '')
  s = s.replace(/```[\s\S]*?```/g, (m) => {
    const inner = m.replace(/^```[^\n]*\n?/, '').replace(/```$/, '')
    return `\n${inner}\n`
  })
  s = s.replace(/!\[([^\]]*)\]\([^)]+\)/g, (_, alt) => (alt ? String(alt) : ''))
  s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  s = s.replace(/^#{1,6}\s+/gm, '')
  s = s.replace(/^>\s?/gm, '')
  s = s.replace(/`([^`]+)`/g, '$1')
  s = s.replace(/\*\*([^*]+)\*\*/g, '$1')
  s = s.replace(/\*([^*]+)\*/g, '$1')
  s = s.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  return s
}

export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  await ensureSeoSchema()
  const id = ctx.params.id
  const article = await (prisma as any).seoArticle.findUnique({
    where: { id },
    select: { id: true, title: true, keywords: true, persona: true, tone: true, targetChars: true, finalMarkdown: true, outline: true },
  })
  if (!article) return NextResponse.json({ success: false, error: 'not found' }, { status: 404 })

  const markdown = String(article.finalMarkdown || article.outline || '')
  const payload = {
    id: article.id,
    title: article.title,
    keywords: article.keywords,
    persona: article.persona,
    tone: article.tone,
    targetChars: article.targetChars,
    markdown,
    text: markdownToPlainText(markdown),
    exportedAt: new Date().toISOString(),
  }

  const filename = `doya-article-${id}.json`
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}


