export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { geminiGenerateJson, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'
import { getUserId } from '@/lib/doyaslide/access'
import { scrapeUrlText } from '@/lib/doyaslide/scrape'
import { buildAnalyzePrompt } from '@/lib/doyaslide/prompts'
import { reserveDoyaSlideTextCall, DoyaSlideTextLimitError } from '@/lib/doyaslide/text-budget'

// POST /api/doyaslide/analyze { url }
// URLの内容を取得し、資料タイトル案・狙い(brief)を自動生成して返す
export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId()
    if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })

    const body = await req.json().catch(() => null)
    const url = body && typeof body === 'object' && !Array.isArray(body) && typeof body.url === 'string'
      ? body.url.trim() : ''
    if (!url) return NextResponse.json({ error: 'URLを入力してください' }, { status: 400 })
    if (url.length > 2048 || !/^https?:\/\//i.test(url)) {
      return NextResponse.json({ error: 'httpまたはhttpsのURLを入力してください' }, { status: 400 })
    }
    try {
      new URL(url)
    } catch {
      return NextResponse.json({ error: 'URLの形式を確認してください' }, { status: 400 })
    }
    await reserveDoyaSlideTextCall(userId, 'url-analysis')

    let scraped
    try {
      scraped = await scrapeUrlText(url)
    } catch (e: any) {
      return NextResponse.json({ error: 'URLの取得に失敗しました。入力内容をご確認ください。' }, { status: 400 })
    }

    const result = await geminiGenerateJson<{ title: string; brief: string }>(
      { prompt: buildAnalyzePrompt(scraped), model: GEMINI_TEXT_MODEL_DEFAULT },
      'UrlAnalysis'
    ).catch(() => {
      console.warn('[doyaslide/analyze] AI proposal unavailable; using page content')
      return null
    })
    const proposedTitle = typeof result?.title === 'string' ? result.title.trim().slice(0, 200) : ''
    const proposedBrief = typeof result?.brief === 'string' ? result.brief.trim().slice(0, 2000) : ''

    // Gemini が落ちても、取得済みのページ情報をフォールバックとして返す（手動編集を継続できる）
    return NextResponse.json({
      title: proposedTitle || scraped.title || '',
      brief: proposedBrief || scraped.description || '',
      referenceText: scraped.text.slice(0, 6000), // structure で再スクレイプせず再利用するため
      sourceTitle: scraped.title,
      aiAnalyzed: !!(proposedTitle || proposedBrief),
    })
  } catch (e: any) {
    if (e instanceof DoyaSlideTextLimitError) {
      return NextResponse.json({
        code: 'DOYASLIDE_TEXT_DAILY_LIMIT',
        error: `本日の参考URL解析の運用上限（${e.limit}回）に達しました。明日お試しいただくか、資料タイトルと補足を直接入力してください。`,
      }, { status: 429 })
    }
    console.error('[doyaslide/analyze]')
    return NextResponse.json({ error: '解析に失敗しました' }, { status: 500 })
  }
}
