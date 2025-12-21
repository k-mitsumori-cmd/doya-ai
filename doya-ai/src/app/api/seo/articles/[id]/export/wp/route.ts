import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ensureSeoSchema } from '@seo/lib/bootstrap'
import { markdownToHtmlBasic } from '@seo/lib/markdown'

function stripOuterHtml(html: string): string {
  return html
    .replace(/<!doctype[\s\S]*?<body>/i, '')
    .replace(/<\/body>[\s\S]*$/i, '')
    .trim()
}

export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  await ensureSeoSchema()
  const id = ctx.params.id
  const article = await (prisma as any).seoArticle.findUnique({
    where: { id },
    include: { knowledgeItems: { where: { type: 'meta' }, orderBy: { createdAt: 'desc' }, take: 1 } },
  })
  if (!article) return NextResponse.json({ success: false, error: 'not found' }, { status: 404 })

  const md = article.finalMarkdown || ''
  const body = markdownToHtmlBasic(md)
  const clean = stripOuterHtml(`<body>${body}</body>`)

  // FAQ JSON-LD（あれば）
  let faqJsonLd = ''
  try {
    const metaItem = article.knowledgeItems?.[0]
    if (metaItem?.content) {
      const meta = JSON.parse(metaItem.content)
      if (meta?.faqSchemaJsonLd) faqJsonLd = String(meta.faqSchemaJsonLd)
    }
  } catch {
    // ignore
  }

  const payload = [
    '<!-- WordPress paste-friendly HTML (clean) -->',
    clean,
    faqJsonLd ? `\n<!-- FAQ JSON-LD -->\n<script type="application/ld+json">\n${faqJsonLd}\n</script>` : '',
  ]
    .filter(Boolean)
    .join('\n')

  const filename = `doya-article-${id}-wp.html`
  return new NextResponse(payload, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}




