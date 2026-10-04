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
import { generateInterviewContent, InterviewGeminiError } from '@/lib/interview/gemini-request'
import { parseFactCheckOutput } from '@/lib/interview/ai-output'
import { auxAdmissionError, claimAuxBudget, refundAuxBudget, type AuxClaim } from '@/lib/interview/aux-budget'

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

  let claim: AuxClaim | null = null
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

    if (!draft.content || draft.content.length < 50) {
      return NextResponse.json(
        { success: false, error: 'ファクトチェックするには記事が短すぎます' },
        { status: 400 }
      )
    }

    const apiKey = getGeminiApiKey()
    const model = getModel()
    const admission = await claimAuxBudget({ userId, guestId, plan, projectId: draft.project.id })
    if (admission.state !== 'allowed') return auxAdmissionError(admission, plan)
    claim = admission.claim

    const prompt = `あなたは記事の確認候補を抽出する編集者です。渡されるのは記事本文だけで、外部資料や一次資料にはアクセスできません。記事内の矛盾や、公開前に裏付けを確認すべき数値・固有名詞・日付・引用を挙げてください。

【チェック項目】
1. 数値データ: 統計、金額、パーセンテージの妥当性
2. 固有名詞: 人名・企業名・サービス名のスペル・正式名称
3. 日付・時期: 年月日の正確性
4. 主張・事実: 事実と意見の区別、検証可能な主張
5. 引用: 発言の文脈との整合性
6. 一般常識: 明らかな事実誤認

【重要】
- 外部資料による真偽判定はできません。「確認済」とは判定せず、資料照合が必要な記述は unverifiable または suspicious としてください
- インタビュー対象者の個人的な意見や体験談は事実確認の対象外
- error は記事本文の中だけで明白に矛盾する場合に限ってください
- reliability は記事内の整合性についてのAI参考値であり、外部的な事実の正確さの点数ではありません

【出力形式】
以下のJSON形式のみ出力してください。

{
  "reliability": 85,
  "summary": "全体的な信頼性の評価",
  "claims": [
    {
      "text": "検証対象の文章",
      "category": "number",
      "status": "unverifiable",
      "detail": "検証結果の詳細",
      "severity": "low"
    }
  ],
  "warnings": ["全体に対する警告事項"]
}

category: number(数値), name(固有名詞), date(日付), claim(主張), quote(引用), general(一般)
status: suspicious(要確認), error(記事内の矛盾), unverifiable(一次資料との照合待ち)
severity: high(重大な矛盾), medium(確認推奨), low(軽微), info(参考情報)

====== 検証対象記事 ======
${draft.content.slice(0, 60000)}`

    const geminiData = await generateInterviewContent(apiKey, model, prompt, {
      temperature: 0.1, maxOutputTokens: 8192,
    }, 110_000)
    const result = parseFactCheckOutput(geminiData?.candidates?.[0]?.content?.parts?.[0]?.text)
    if (!result) {
      return NextResponse.json({ success: false, error: 'ファクトチェック結果を読み取れませんでした。再度お試しください。' }, { status: 502 })
    }

    completed = true
    return NextResponse.json({
      success: true,
      evidenceScope: 'article_only',
      sourceVerified: false,
      reliability: result.reliability,
      summary: result.summary,
      claims: result.claims,
      warnings: result.warnings,
    })
  } catch (e: any) {
    console.error('[interview] fact-check error:')
    return NextResponse.json(
      { success: false, error: e instanceof InterviewGeminiError ? e.message : 'ファクトチェックに失敗しました' },
      { status: e instanceof InterviewGeminiError ? 503 : 500 }
    )
  } finally {
    if (claim && !completed) await refundAuxBudget(claim)
  }
}
