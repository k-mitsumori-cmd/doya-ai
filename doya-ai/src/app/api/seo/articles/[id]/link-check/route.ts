import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { extractLinks } from '@seo/lib/markdown'

async function checkOne(url: string): Promise<{
  url: string
  ok: boolean
  statusCode?: number
  finalUrl?: string
  error?: string
}> {
  try {
    // HEADが落ちるサイトがあるので、失敗したらGETへフォールバック
    let res = await fetch(url, { method: 'HEAD', redirect: 'follow' })
    if (!res.ok) {
      res = await fetch(url, { method: 'GET', redirect: 'follow' })
    }
    return {
      url,
      ok: res.ok,
      statusCode: res.status,
      finalUrl: res.url || undefined,
    }
  } catch (e: any) {
    return { url, ok: false, error: e?.message || 'fetch failed' }
  }
}

export async function POST(_req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const articleId = ctx.params.id
    const article = await prisma.seoArticle.findUnique({ where: { id: articleId } })
    if (!article) return NextResponse.json({ success: false, error: 'not found' }, { status: 404 })
    if (!article.finalMarkdown) {
      return NextResponse.json(
        { success: false, error: 'finalMarkdown がありません（先に記事生成を完了してください）' },
        { status: 400 }
      )
    }

    const links = extractLinks(article.finalMarkdown).slice(0, 300)
    const concurrency = 5
    const results: any[] = []

    for (let i = 0; i < links.length; i += concurrency) {
      const batch = links.slice(i, i + concurrency)
      const batchRes = await Promise.all(batch.map(checkOne))
      results.push(...batchRes)
    }

    for (const r of results) {
      await prisma.seoLinkCheckResult.upsert({
        where: { articleId_url: { articleId, url: r.url } },
        create: {
          articleId,
          url: r.url,
          ok: !!r.ok,
          statusCode: r.statusCode ?? null,
          finalUrl: r.finalUrl ?? null,
          error: r.error ?? null,
          checkedAt: new Date(),
        },
        update: {
          ok: !!r.ok,
          statusCode: r.statusCode ?? null,
          finalUrl: r.finalUrl ?? null,
          error: r.error ?? null,
          checkedAt: new Date(),
        },
      })
    }

    return NextResponse.json({ success: true, count: results.length })
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || '不明なエラー' },
      { status: 500 }
    )
  }
}


