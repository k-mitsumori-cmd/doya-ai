// ============================================
// POST /api/copy/analyze-url
// ============================================
// 商品URLを解析してproductInfoを返す

import { NextRequest, NextResponse } from 'next/server'
import { analyzeProductUrl } from '@/lib/copy/gemini'

function extractTextFromHTML(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 5000)
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json()

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URLが必要です' }, { status: 400 })
    }

    // URLからHTML取得
    let html = ''
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'DoyaCopyBot/1.0 (for ad copy generation)' },
        signal: AbortSignal.timeout(10000),
      })
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      html = await res.text()
    } catch {
      return NextResponse.json(
        { error: 'URLからコンテンツを取得できませんでした。URLを確認してください。' },
        { status: 400 }
      )
    }

    const plainText = extractTextFromHTML(html)
    const productInfo = await analyzeProductUrl(url, plainText)

    return NextResponse.json({ success: true, productInfo })
  } catch (error: any) {
    console.error('Copy analyze-url error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
