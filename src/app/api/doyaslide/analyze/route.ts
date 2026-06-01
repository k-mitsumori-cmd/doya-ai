export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { geminiGenerateJson, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'
import { getUserId } from '@/lib/doyaslide/access'
import { scrapeUrlText } from '@/lib/doyaslide/scrape'
import { buildAnalyzePrompt } from '@/lib/doyaslide/prompts'

// POST /api/doyaslide/analyze { url }
// URLの内容を取得し、資料タイトル案・狙い(brief)を自動生成して返す
export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId()
    if (!userId) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const url = (body.url as string)?.trim()
    if (!url) return NextResponse.json({ error: 'URLを入力してください' }, { status: 400 })

    let scraped
    try {
      scraped = await scrapeUrlText(url)
    } catch (e: any) {
      return NextResponse.json({ error: e?.message || 'URLの取得に失敗しました' }, { status: 400 })
    }

    const result = await geminiGenerateJson<{ title: string; brief: string }>(
      { prompt: buildAnalyzePrompt(scraped), model: GEMINI_TEXT_MODEL_DEFAULT },
      'UrlAnalysis'
    ).catch(() => null)

    // Gemini が落ちても、取得済みのページ情報をフォールバックとして返す（手動編集を継続できる）
    return NextResponse.json({
      title: result?.title || scraped.title || '',
      brief: result?.brief || scraped.description || '',
      referenceText: scraped.text.slice(0, 6000), // structure で再スクレイプせず再利用するため
      sourceTitle: scraped.title,
    })
  } catch (e: any) {
    console.error('[doyaslide/analyze]', e?.message)
    return NextResponse.json({ error: '解析に失敗しました' }, { status: 500 })
  }
}
