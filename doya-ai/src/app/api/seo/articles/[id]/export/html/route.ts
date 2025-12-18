import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { markdownToHtmlBasic } from '@seo/lib/markdown'

export async function GET(_req: NextRequest, ctx: { params: { id: string } }) {
  const id = ctx.params.id
  const article = await prisma.seoArticle.findUnique({ where: { id } })
  if (!article) return NextResponse.json({ success: false, error: 'not found' }, { status: 404 })
  const md = article.finalMarkdown || ''
  const body = markdownToHtmlBasic(md)

  const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${article.title}</title>
  <style>
    body{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.7;margin:32px;max-width:920px}
    table{border-collapse:collapse;width:100%;margin:16px 0}
    th,td{border:1px solid #ddd;padding:8px;vertical-align:top}
    pre{background:#0b1020;color:#e5e7eb;padding:12px;overflow:auto;border-radius:8px}
    code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
    a{color:#2563eb}
    h1,h2,h3,h4{line-height:1.25}
    img{max-width:100%;height:auto}
  </style>
</head>
<body>
${body}
</body>
</html>`

  const filename = `doya-article-${id}.html`
  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}


