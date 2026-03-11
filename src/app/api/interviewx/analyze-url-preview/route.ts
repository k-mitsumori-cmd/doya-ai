// ============================================
// POST /api/interviewx/analyze-url-preview
// ============================================
// プロジェクト作成前のURL調査プレビューAPI
// 認証必須、DBアクセス不要

import { NextRequest, NextResponse } from 'next/server'
import { getInterviewXUser, requireAuth } from '@/lib/interviewx/access'
import { scrapeUrl } from '@/lib/tenkai/scraper'
import { buildUrlAnalysisPrompt } from '@/lib/interviewx/prompts'

function getGeminiApiKey(): string {
  const key =
    process.env.GOOGLE_GENAI_API_KEY ||
    process.env.GOOGLE_AI_API_KEY ||
    process.env.GEMINI_API_KEY
  if (!key) throw new Error('Gemini APIキーが設定されていません')
  return key.trim()
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await getInterviewXUser()
    const authErr = requireAuth(userId)
    if (authErr) return authErr

    const body = await req.json()
    const url = body.url
    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { success: false, error: 'URLを指定してください' },
        { status: 400 }
      )
    }

    // 1. スクレイピング
    const scraped = await scrapeUrl(url)

    // 2. Gemini分析
    const apiKey = getGeminiApiKey()
    const model = 'gemini-2.0-flash'
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

    const prompt = buildUrlAnalysisPrompt(scraped.content)

    const geminiRes = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json',
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
        ],
      }),
    })

    if (!geminiRes.ok) {
      return NextResponse.json(
        { success: false, error: `AI分析エラー (${geminiRes.status})` },
        { status: 502 }
      )
    }

    const geminiData = await geminiRes.json()
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text
    if (!rawText) {
      return NextResponse.json(
        { success: false, error: 'AI分析結果が空です' },
        { status: 502 }
      )
    }

    let analysis: any
    try {
      let jsonStr = rawText.trim()
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (jsonMatch) jsonStr = jsonMatch[1].trim()
      analysis = JSON.parse(jsonStr)
    } catch {
      return NextResponse.json(
        { success: false, error: 'AI分析結果のパースに失敗しました' },
        { status: 502 }
      )
    }

    return NextResponse.json({
      success: true,
      analysis,
      robotsWarning: scraped.robotsWarning || null,
    })
  } catch (e: any) {
    const msg = e?.message?.includes('内部ネットワーク')
      ? e.message
      : e?.message?.includes('テキストを抽出')
        ? e.message
        : 'URL調査に失敗しました'
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    )
  }
}
