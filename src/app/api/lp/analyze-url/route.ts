export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { geminiGenerateJson, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'
import { buildAnalyzeUrlPrompt } from '@/lib/lp/prompts'
import type { LpProductInfo } from '@/lib/lp/types'
import * as cheerio from 'cheerio'

const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

function extractPageInfo(html: string) {
  const $ = cheerio.load(html)

  // メタ / OGタグ抽出
  const title = $('title').first().text().trim()
  const description =
    $('meta[name="description"]').attr('content')?.trim() ||
    $('meta[property="og:description"]').attr('content')?.trim() || ''
  const ogTitle =
    $('meta[property="og:title"]').attr('content')?.trim() || ''
  const ogImage =
    $('meta[property="og:image"]').attr('content')?.trim() || ''
  const keywords =
    $('meta[name="keywords"]').attr('content')?.trim() || ''

  // 不要タグ除去
  $('script, style, svg, noscript, iframe, link, nav, footer').remove()

  // テキストコンテンツ抽出
  const textContent = $('body').text().replace(/\s+/g, ' ').trim()

  return {
    title,
    description,
    ogTitle,
    ogImage,
    keywords,
    textContent,
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { url } = await req.json()
    if (!url) {
      return NextResponse.json({ error: 'url is required' }, { status: 400 })
    }

    // URLバリデーション
    try {
      new URL(url)
    } catch {
      return NextResponse.json({ error: '有効なURLを入力してください。' }, { status: 400 })
    }

    // URLからHTMLを取得
    let rawHtml = ''
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 20000)
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': CHROME_UA,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ja,en;q=0.9',
        },
        redirect: 'follow',
      })
      clearTimeout(timeout)
      if (!response.ok) {
        return NextResponse.json(
          { error: `URLの取得に失敗しました（HTTP ${response.status}）。URLを確認してください。` },
          { status: 400 }
        )
      }
      rawHtml = await response.text()
    } catch (e: any) {
      const msg = e?.name === 'AbortError'
        ? 'URLの取得がタイムアウトしました。サイトが応答しない可能性があります。'
        : 'URLの取得に失敗しました。URLが正しいか、サイトがアクセス可能か確認してください。'
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    // HTMLからテキスト・メタ情報を抽出
    const pageInfo = extractPageInfo(rawHtml)

    // コンテンツが少なすぎる場合のチェック
    const metaText = [pageInfo.title, pageInfo.ogTitle, pageInfo.description, pageInfo.keywords]
      .filter(Boolean).join(' ')

    if (pageInfo.textContent.length < 50 && metaText.length < 30) {
      return NextResponse.json(
        { error: 'ページから十分な情報を取得できませんでした。JavaScript描画のみのページか、アクセスが制限されている可能性があります。手動入力をお試しください。' },
        { status: 400 }
      )
    }

    // Gemini でページ情報から商品情報を抽出
    const prompt = buildAnalyzeUrlPrompt(url, pageInfo.textContent.slice(0, 15000), {
      title: pageInfo.title,
      ogTitle: pageInfo.ogTitle,
      description: pageInfo.description,
      keywords: pageInfo.keywords,
    })
    const productInfo = await geminiGenerateJson<LpProductInfo>({ model: GEMINI_TEXT_MODEL_DEFAULT, prompt })

    return NextResponse.json({ productInfo })
  } catch (error) {
    console.error('[POST /api/lp/analyze-url]', error)
    return NextResponse.json({ error: 'AIによる解析中にエラーが発生しました。もう一度お試しください。' }, { status: 500 })
  }
}
