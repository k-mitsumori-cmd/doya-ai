import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureSeoSchema } from '@seo/lib/bootstrap'

export const runtime = 'nodejs'

function markdownToPlainText(md: string): string {
  let s = String(md || '')
  // remove HTML comments
  s = s.replace(/<!--[\s\S]*?-->/g, '')
  // remove code fences but keep content
  s = s.replace(/```[\s\S]*?```/g, (m) => {
    const inner = m.replace(/^```[^\n]*\n?/, '').replace(/```$/, '')
    return `\n${inner}\n`
  })
  // images -> alt text
  s = s.replace(/!\[([^\]]*)\]\([^)]+\)/g, (_, alt) => (alt ? String(alt) : ''))
  // links -> text
  s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
  // headings
  s = s.replace(/^#{1,6}\s+/gm, '')
  // blockquotes
  s = s.replace(/^>\s?/gm, '')
  // list markers
  s = s.replace(/^\s*[-*+]\s+/gm, '・')
  s = s.replace(/^\s*\d+\.\s+/gm, '・')
  // inline code/bold/italic
  s = s.replace(/`([^`]+)`/g, '$1')
  s = s.replace(/\*\*([^*]+)\*\*/g, '$1')
  s = s.replace(/\*([^*]+)\*/g, '$1')
  s = s.replace(/__([^_]+)__/g, '$1')
  s = s.replace(/_([^_]+)_/g, '$1')
  // tables: keep pipes but collapse extra spaces
  s = s.replace(/^\|.*\|$/gm, (line) => line.replace(/\s*\|\s*/g, ' | ').trim())
  // normalize whitespace
  s = s.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  return s
}

export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  await ensureSeoSchema()
  const id = ctx.params.id
  const article = await (prisma as any).seoArticle.findUnique({ where: { id }, select: { title: true, finalMarkdown: true, outline: true } })
  if (!article) return NextResponse.json({ success: false, error: 'not found' }, { status: 404 })
  const md = article.finalMarkdown || article.outline || ''
  const text = markdownToPlainText(md)

  const filename = `doya-article-${id}.txt`
  return new NextResponse(text, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}


