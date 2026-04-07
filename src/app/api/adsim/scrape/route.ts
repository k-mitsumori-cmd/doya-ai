// ============================================
// POST /api/adsim/scrape
// ============================================
// LP URL をスクレイピングしてタイトル・ディスクリプション・H1を抽出し、
// ウィザードの商材情報欄を自動補完する。
// cheerio（既存依存）を使うだけの軽量実装。

import { NextRequest, NextResponse } from 'next/server'
import * as cheerio from 'cheerio'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'url is required' }, { status: 400 })
    }
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      return NextResponse.json({ error: 'invalid url' }, { status: 400 })
    }

    const res = await fetch(parsed.toString(), {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; DoyaAdSimBot/1.0; +https://doya-ai.surisuta.jp/adsim)',
      },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      return NextResponse.json(
        { error: `fetch failed: ${res.status}` },
        { status: 502 }
      )
    }

    const html = await res.text()
    const $ = cheerio.load(html)

    const title =
      $('meta[property="og:title"]').attr('content') ||
      $('title').first().text().trim() ||
      ''
    const description =
      $('meta[name="description"]').attr('content') ||
      $('meta[property="og:description"]').attr('content') ||
      ''
    const h1s: string[] = []
    $('h1').each((_, el) => {
      const t = $(el).text().trim()
      if (t) h1s.push(t)
    })
    const ogImage = $('meta[property="og:image"]').attr('content') || null

    return NextResponse.json({
      ok: true,
      title: title.substring(0, 200),
      description: description.substring(0, 400),
      h1s: h1s.slice(0, 5),
      ogImage,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[adsim] scrape error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
