export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  }

  const body = await req.json()
  const { myServiceDesc, myStrengths, targetHint } = body

  if (!myServiceDesc) {
    return NextResponse.json({ error: 'サービス説明は必須です' }, { status: 400 })
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_GENAI_API_KEY
  if (!GEMINI_API_KEY) {
    return NextResponse.json({ error: 'AI APIキーが設定されていません' }, { status: 500 })
  }

  const model = 'gemini-2.0-flash'
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`

  const prompt = `あなたは営業戦略のプロフェッショナルです。以下の情報をもとに、最適な営業ターゲット条件を提案してください。

【自社サービス】
${myServiceDesc}

【自社の強み】
${myStrengths || '未入力'}

${targetHint ? `【ユーザーの補足】\n${targetHint}` : ''}

以下のJSON形式で回答してください:
{
  "industries": ["推奨業種1", "推奨業種2", ...],
  "areas": ["推奨エリア1", "推奨エリア2", ...],
  "keywords": ["検索キーワード1", "検索キーワード2", ...],
  "companySize": { "minEmployees": 10, "maxEmployees": 100 },
  "reasoning": "この条件を推奨する理由の説明",
  "approachTips": "このターゲットへのアプローチのコツ"
}`

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, responseMimeType: 'application/json' }
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Gemini API error:', errorText)
      return NextResponse.json({ error: 'AI分析に失敗しました' }, { status: 500 })
    }

    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) {
      return NextResponse.json({ error: 'AI応答の解析に失敗しました' }, { status: 500 })
    }

    const suggestion = JSON.parse(text)
    return NextResponse.json(suggestion)
  } catch (error) {
    console.error('suggest-target error:', error)
    return NextResponse.json({ error: 'ターゲット提案の生成に失敗しました' }, { status: 500 })
  }
}
