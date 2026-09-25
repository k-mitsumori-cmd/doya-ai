import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSeoArticleOwner } from '@/lib/seoArticleOwner'
import { safeFetchResource, type SafeFetchFailure } from '@/lib/net/safe-fetch'
import { extractLinks } from '@seo/lib/markdown'
import { ensureSeoSchema } from '@seo/lib/bootstrap'

export const runtime = 'nodejs'

async function checkOne(url: string, signal: AbortSignal): Promise<{
  url: string
  ok: boolean
  statusCode?: number
  finalUrl?: string
  error?: string
}> {
  let failure: SafeFetchFailure | undefined
  const options = { signal, timeoutMs: 8000, maxRedirects: 3, accept: '*/*', headersOnly: true, onFailure: (value: SafeFetchFailure) => { failure = value } }
  let res = await safeFetchResource(url, { ...options, method: 'HEAD' })
  if (!res && failure?.reason === 'http' && !signal.aborted) {
    res = await safeFetchResource(url, { ...options, method: 'GET' })
  }
  return res
    ? { url, ok: true, statusCode: res.status, finalUrl: res.url }
    : { url, ok: false, statusCode: failure?.status, error: failure?.reason === 'http' ? 'HTTPエラー' : '安全性または通信制限により確認できませんでした' }

}

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const owner = await getSeoArticleOwner(_req)
    if (!owner) return NextResponse.json({ success: false, error: 'ログインが必要です' }, { status: 401 })
    await ensureSeoSchema()
    const p = await ctx.params
    const articleId = p.id
    const article = await prisma.seoArticle.findFirst({ where: { id: articleId, ...owner } })
    if (!article) return NextResponse.json({ success: false, error: 'not found' }, { status: 404 })
    if (!article.finalMarkdown) {
      return NextResponse.json(
        { success: false, error: 'finalMarkdown がありません（先に記事生成を完了してください）' },
        { status: 400 }
      )
    }

    const links = extractLinks(article.finalMarkdown).slice(0, 300)
    const concurrency = 5
    const signal = AbortSignal.timeout(20000)
    const results: any[] = []

    for (let i = 0; i < links.length; i += concurrency) {
      const batch = links.slice(i, i + concurrency)
      const batchRes = await Promise.all(batch.map(url => checkOne(url, signal)))
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
    console.error('[seo link-check] failed', e)
    return NextResponse.json(
      { success: false, error: 'リンクをチェックできませんでした。時間をおいて再試行してください。' },
      { status: 500 }
    )
  }
}
