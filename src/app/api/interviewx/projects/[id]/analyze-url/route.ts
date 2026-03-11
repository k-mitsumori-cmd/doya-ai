// ============================================
// POST /api/interviewx/projects/[id]/analyze-url
// ============================================
// URL調査API — 企業URLをスクレイピングしてAIで情報抽出

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getInterviewXUser, requireAuth, checkOwnership, requireDatabase } from '@/lib/interviewx/access'
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

type RouteParams = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const dbErr = requireDatabase()
    if (dbErr) return dbErr

    const { userId } = await getInterviewXUser()
    const authErr = requireAuth(userId)
    if (authErr) return authErr

    const { id } = await params

    const project = await prisma.interviewXProject.findUnique({
      where: { id },
    })
    if (!project) {
      return NextResponse.json(
        { success: false, error: 'プロジェクトが見つかりません' },
        { status: 404 }
      )
    }

    const ownerErr = checkOwnership(project, userId)
    if (ownerErr) return ownerErr

    // リクエストボディからURLを取得（またはプロジェクトのcompanyUrlを使用）
    const body = await req.json().catch(() => ({}))
    const url = body.url || project.companyUrl
    if (!url) {
      return NextResponse.json(
        { success: false, error: '調査するURLを指定してください' },
        { status: 400 }
      )
    }

    // 1. URLスクレイピング
    const scraped = await scrapeUrl(url)

    // 2. Gemini APIで企業情報抽出
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
      const errText = await geminiRes.text()
      console.error('[interviewx] Gemini analyze-url error:', geminiRes.status, errText)
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

    // 3. JSONパース
    let analysis: any
    try {
      let jsonStr = rawText.trim()
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (jsonMatch) jsonStr = jsonMatch[1].trim()
      analysis = JSON.parse(jsonStr)
    } catch {
      console.error('[interviewx] analyze-url JSON parse error:', rawText.slice(0, 500))
      return NextResponse.json(
        { success: false, error: 'AI分析結果のパースに失敗しました' },
        { status: 502 }
      )
    }

    // 4. DB保存
    const updatedProject = await prisma.interviewXProject.update({
      where: { id },
      data: {
        companyUrl: url,
        companyAnalysis: analysis,
        ...(analysis.companyName && !project.companyName ? { companyName: analysis.companyName } : {}),
      },
    })

    return NextResponse.json({
      success: true,
      analysis,
      robotsWarning: scraped.robotsWarning || null,
    })
  } catch (e: any) {
    console.error('[interviewx] analyze-url error:', e?.message)
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
