// ============================================
// POST /api/interview/articles/[id]/proofread
// ============================================
// 校正・校閲 — 記事の誤字脱字・表記揺れ・文法エラーを検出し、
// 修正候補を位置情報付きで返す

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getInterviewUser, getGuestIdFromRequest, checkOwnership, requireDatabase } from '@/lib/interview/access'

type Ctx = { params: Promise<{ id: string }> | { id: string } }

async function resolveId(ctx: Ctx): Promise<string> {
  const p = 'then' in ctx.params ? await ctx.params : ctx.params
  return p.id
}

function getGeminiApiKey(): string {
  const key =
    process.env.GOOGLE_GENAI_API_KEY ||
    process.env.GOOGLE_AI_API_KEY ||
    process.env.GEMINI_API_KEY
  if (!key) throw new Error('Gemini APIキーが設定されていません')
  return key.trim()
}

function getModel(): string {
  return process.env.INTERVIEW_GEMINI_MODEL || process.env.GEMINI_TEXT_MODEL || 'gemini-2.0-flash'
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const dbErr = requireDatabase()
  if (dbErr) return dbErr

  try {
    const draftId = await resolveId(ctx)
    const { userId } = await getInterviewUser()
    const guestId = !userId ? getGuestIdFromRequest(req) : null

    const draft = await prisma.interviewDraft.findUnique({
      where: { id: draftId },
      include: { project: { select: { id: true, userId: true, guestId: true, title: true } } },
    })

    if (!draft) {
      return NextResponse.json({ success: false, error: '見つかりませんでした' }, { status: 404 })
    }

    const ownerErr = checkOwnership(draft.project, userId, guestId)
    if (ownerErr) return ownerErr

    if (!draft.content || draft.content.length < 10) {
      return NextResponse.json(
        { success: false, error: '校正するには記事内容が短すぎます' },
        { status: 400 }
      )
    }

    // Gemini API で校正実行
    const apiKey = getGeminiApiKey()
    const model = getModel()
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

    const prompt = `あなたはプロの校正者です。以下の日本語記事を校正・校閲してください。

【チェック項目】
1. 誤字脱字
2. 表記揺れ（同じ意味の言葉が異なる表記で使われている場合）
3. 文法エラー
4. 不自然な日本語表現
5. 句読点の使い方
6. 事実関係の疑わしい記述（あれば）

【出力形式】
以下のJSON形式で出力してください。他のテキストは不要です。

{
  "score": 85,
  "summary": "全体的に良好ですが、3箇所の表記揺れと1箇所の誤字を検出しました",
  "suggestions": [
    {
      "type": "typo",
      "original": "誤った文字列",
      "suggested": "正しい文字列",
      "reason": "修正理由",
      "severity": "high"
    }
  ],
  "checks": {
    "grammar": true,
    "facts": true,
    "consistency": false,
    "readability": true
  }
}

type は以下のいずれか: typo(誤字脱字), inconsistency(表記揺れ), grammar(文法), style(文体), fact(事実関係)
severity は: high(必ず修正), medium(修正推奨), low(好み)

====== 校正対象記事 ======
${draft.content.slice(0, 60000)}`

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Gemini API エラー (${res.status}): ${errText.slice(0, 200)}`)
    }

    const geminiData = await res.json()
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || ''

    // JSON抽出
    let result: any
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/)
      result = jsonMatch ? JSON.parse(jsonMatch[0]) : { score: 0, summary: '解析失敗', suggestions: [] }
    } catch {
      result = { score: 0, summary: '校正結果の解析に失敗しました', suggestions: [], raw: rawText.slice(0, 1000) }
    }

    // 校閲結果をDBに保存
    const review = await prisma.interviewReview.create({
      data: {
        projectId: draft.project.id,
        draftId: draft.id,
        report: result.summary || '',
        checks: result.checks || null,
        score: result.score ?? null,
        readabilityScore: null,
        suggestions: result.suggestions || [],
      },
    })

    return NextResponse.json({
      success: true,
      reviewId: review.id,
      score: result.score,
      summary: result.summary,
      suggestions: result.suggestions || [],
      checks: result.checks || {},
    })
  } catch (e: any) {
    console.error('[interview] proofread error:', e?.message)
    return NextResponse.json(
      { success: false, error: e?.message || '校正に失敗しました' },
      { status: 500 }
    )
  }
}
