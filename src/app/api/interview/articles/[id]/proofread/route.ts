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
import { generateInterviewContent, InterviewGeminiError } from '@/lib/interview/gemini-request'
import { parseProofreadOutput } from '@/lib/interview/ai-output'
import { auxAdmissionError, claimAuxBudget, claimIncludedProofread, finishIncludedProofread, refundAuxBudget, refundIncludedProofread, type AuxClaim, type IncludedProofreadClaim } from '@/lib/interview/aux-budget'

type Ctx = { params: Promise<{ id: string }> }

async function resolveId(ctx: Ctx): Promise<string> {
  const p = await ctx.params
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
  return process.env.INTERVIEW_GEMINI_MODEL || process.env.GEMINI_TEXT_MODEL || 'gemini-2.5-flash'
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const dbErr = requireDatabase()
  if (dbErr) return dbErr

  let auxClaim: AuxClaim | null = null
  let includedClaim: IncludedProofreadClaim | null = null
  let completed = false
  try {
    const draftId = await resolveId(ctx)
    const { userId, plan } = await getInterviewUser()
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
    const previousReview = await prisma.interviewReview.findFirst({ where: { draftId: draft.id }, select: { id: true } })
    const included = previousReview ? { state: 'already' as const } : await claimIncludedProofread(draft.id)
    if (included.state === 'allowed') {
      includedClaim = included.claim
    } else if (included.state === 'busy') {
      return NextResponse.json({ success: false, error: 'この記事の校正を実行中です。完了後に再度お試しください。' }, { status: 409 })
    } else if (included.state === 'unavailable') {
      return NextResponse.json({ success: false, error: '利用状況を確認できません。時間をおいて再試行してください。' }, { status: 503 })
    } else {
      const admission = await claimAuxBudget({ userId, guestId, plan })
      if (admission.state !== 'allowed') return auxAdmissionError(admission)
      auxClaim = admission.claim
    }

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

    const geminiData = await generateInterviewContent(apiKey, model, prompt, {
      temperature: 0.1, maxOutputTokens: 8192,
    }, 110_000)
    const result = parseProofreadOutput(geminiData?.candidates?.[0]?.content?.parts?.[0]?.text)
    if (!result) {
      return NextResponse.json({ success: false, error: '校正結果を読み取れませんでした。再度お試しください。' }, { status: 502 })
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

    completed = true
    if (includedClaim && !await finishIncludedProofread(includedClaim)) {
      console.error('[interview] included proofread could not be settled')
    }

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
      { success: false, error: e instanceof InterviewGeminiError ? e.message : '校正に失敗しました' },
      { status: e instanceof InterviewGeminiError ? 503 : 500 }
    )
  } finally {
    if (!completed && includedClaim) await refundIncludedProofread(includedClaim)
    if (!completed && auxClaim) await refundAuxBudget(auxClaim)
  }
}
