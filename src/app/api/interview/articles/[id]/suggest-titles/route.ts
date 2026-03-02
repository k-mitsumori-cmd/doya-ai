// ============================================
// POST /api/interview/articles/[id]/suggest-titles
// ============================================
// プラットフォーム別にタイトルを複数提案

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

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

const PLATFORM_PROMPTS: Record<string, string> = {
  seo: 'SEO向け: 検索キーワードを含み、32〜40文字。クリック率を高める具体性と数字を含む。',
  twitter: 'X(Twitter)向け: 140文字以内の投稿文として機能する。好奇心を刺激し、RTされやすい。',
  facebook: 'Facebook向け: 共感を呼ぶストーリー性。ビジネスパーソン向けのトーン。',
  note: 'note向け: 読者が「読みたい」と思うエモーショナルなタイトル。体験談調。',
  news_portal: 'ニュースサイト向け: 速報性・客観性。5W1Hを含む簡潔な見出し。',
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
      include: { project: { select: { id: true, userId: true, guestId: true, title: true, targetAudience: true } } },
    })

    if (!draft) {
      return NextResponse.json({ success: false, error: '見つかりませんでした' }, { status: 404 })
    }

    const ownerErr = checkOwnership(draft.project, userId, guestId)
    if (ownerErr) return ownerErr

    const body = await req.json()
    const platform = body.platform || 'seo'
    const count = Math.min(body.count || 5, 10)

    const platformGuide = PLATFORM_PROMPTS[platform] || PLATFORM_PROMPTS.seo

    const apiKey = getGeminiApiKey()
    const model = getModel()
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

    const articleSummary = draft.content.slice(0, 5000)

    const prompt = `あなたはプロの編集者です。以下のインタビュー記事に対して、魅力的なタイトルを${count}案提案してください。

【プラットフォーム特性】
${platformGuide}

【タイトルのバリエーション方針】
- キーワード型: 検索されやすいキーワードを前方に配置
- 感情型: 読者の感情を動かす表現
- 疑問型: 「なぜ〜なのか？」形式で好奇心を刺激
- 数字型: 具体的な数字を含める
- 引用型: インタビュー対象者の印象的な発言を活用

【記事情報】
元タイトル: ${draft.project.title}
想定読者: ${draft.project.targetAudience || '特に指定なし'}

【記事冒頭】
${articleSummary}

【出力形式】
以下のJSON配列のみ出力してください。

[
  { "title": "タイトル案", "type": "keyword", "reason": "このタイトルの意図" },
  ...
]

type は keyword / emotional / question / number / quote のいずれか`

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.8, maxOutputTokens: 4096 },
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Gemini API エラー (${res.status}): ${errText.slice(0, 200)}`)
    }

    const geminiData = await res.json()
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || ''

    let titles: any[] = []
    try {
      const jsonMatch = rawText.match(/\[[\s\S]*\]/)
      titles = jsonMatch ? JSON.parse(jsonMatch[0]) : []
    } catch {
      titles = []
    }

    return NextResponse.json({
      success: true,
      platform,
      titles,
    })
  } catch (e: any) {
    console.error('[interview] suggest-titles error:', e?.message)
    return NextResponse.json(
      { success: false, error: e?.message || 'タイトル提案に失敗しました' },
      { status: 500 }
    )
  }
}
