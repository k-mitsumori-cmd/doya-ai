export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { geminiGenerateJson, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'
import { buildAnalyzeUrlPrompt } from '@/lib/lp/prompts'
import type { LpProductInfo } from '@/lib/lp/types'

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

    // URLからHTMLを取得
    let htmlContent = ''
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 8000)
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DoyaLpBot/1.0)' },
      })
      clearTimeout(timeout)
      htmlContent = await response.text()
    } catch {
      return NextResponse.json({ error: 'URLの取得に失敗しました。URLを確認してください。' }, { status: 400 })
    }

    // Gemini でHTMLから商品情報を抽出
    const prompt = buildAnalyzeUrlPrompt(url, htmlContent)
    const productInfo = await geminiGenerateJson<LpProductInfo>({ model: GEMINI_TEXT_MODEL_DEFAULT, prompt })

    return NextResponse.json({ productInfo })
  } catch (error) {
    console.error('[POST /api/lp/analyze-url]', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
