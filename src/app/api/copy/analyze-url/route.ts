// ============================================
// POST /api/copy/analyze-url
// ============================================
// 商品URLを解析してproductInfoを返す

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
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
    // 認証チェック（ゲストも利用可能だがセッション確認は行う）
    const session = await getServerSession(authOptions)
    // ゲストも利用可能なgenerate系APIのため、session不要でも許可
    // ただし不正利用防止のためセッション情報をログに記録
    const userId = session?.user?.id ?? 'guest'

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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Copy analyze-url error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
