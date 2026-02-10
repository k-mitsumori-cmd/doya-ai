// ============================================
// POST /api/interview/articles/[id]/fact-check
// ============================================
// ファクトチェック — 記事内の主張・数値・固有名詞を検証し、
// 要確認箇所をリストアップ

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

    if (!draft.content || draft.content.length < 50) {
      return NextResponse.json(
        { success: false, error: 'ファクトチェックするには記事が短すぎます' },
        { status: 400 }
      )
    }

    const apiKey = getGeminiApiKey()
    const model = getModel()
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

    const prompt = `あなたはプロのファクトチェッカーです。以下の記事に含まれる事実関係・数値・固有名詞・日付・引用を検証してください。

【チェック項目】
1. 数値データ: 統計、金額、パーセンテージの妥当性
2. 固有名詞: 人名・企業名・サービス名のスペル・正式名称
3. 日付・時期: 年月日の正確性
4. 主張・事実: 事実と意見の区別、検証可能な主張
5. 引用: 発言の文脈との整合性
6. 一般常識: 明らかな事実誤認

【重要】
- 検証できない主張は「要確認」として報告
- インタビュー対象者の個人的な意見や体験談は事実確認の対象外
- 確実に誤りと判断できるものと、確認推奨のものを区別すること

【出力形式】
以下のJSON形式のみ出力してください。

{
  "reliability": 85,
  "summary": "全体的な信頼性の評価",
  "claims": [
    {
      "text": "検証対象の文章",
      "category": "number",
      "status": "verified",
      "detail": "検証結果の詳細",
      "severity": "low"
    }
  ],
  "warnings": ["全体に対する警告事項"]
}

category: number(数値), name(固有名詞), date(日付), claim(主張), quote(引用), general(一般)
status: verified(確認済), suspicious(要確認), error(誤り), unverifiable(検証不能)
severity: high(重大な誤り), medium(確認推奨), low(軽微), info(参考情報)

====== 検証対象記事 ======
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

    let result: any
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/)
      result = jsonMatch ? JSON.parse(jsonMatch[0]) : { reliability: 0, summary: '解析失敗', claims: [] }
    } catch {
      result = { reliability: 0, summary: 'ファクトチェック結果の解析に失敗しました', claims: [], raw: rawText.slice(0, 1000) }
    }

    return NextResponse.json({
      success: true,
      reliability: result.reliability ?? 0,
      summary: result.summary || '',
      claims: result.claims || [],
      warnings: result.warnings || [],
    })
  } catch (e: any) {
    console.error('[interview] fact-check error:', e?.message)
    return NextResponse.json(
      { success: false, error: e?.message || 'ファクトチェックに失敗しました' },
      { status: 500 }
    )
  }
}
