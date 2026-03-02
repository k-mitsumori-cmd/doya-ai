// ============================================
// POST /api/interview/articles/[id]/sns-posts
// ============================================
// SNS投稿文生成 — 記事からプラットフォーム別の投稿文を自動生成

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

const PLATFORM_SPECS: Record<string, { name: string; maxLength: number; guide: string }> = {
  twitter: {
    name: 'X (Twitter)',
    maxLength: 280,
    guide: `- 280文字以内（URLは23文字換算）
- 改行を効果的に使い、視認性を高める
- 関連ハッシュタグを2〜3個
- RTしたくなるフック（驚き・共感・学び）
- 記事URLの直前に改行を入れる`,
  },
  twitter_thread: {
    name: 'X スレッド',
    maxLength: 280,
    guide: `- 3〜5ツイートのスレッド形式
- 1ツイート目：最も興味を引くフック
- 中間：記事の要点を順番に紹介
- 最後：記事URLとCTA
- 各ツイート280文字以内
- 各ツイートの間に "---" を入れて区切る`,
  },
  facebook: {
    name: 'Facebook',
    maxLength: 2000,
    guide: `- 200〜500文字程度
- ストーリーテリング要素を入れる
- 読者への問いかけでエンゲージメントを促進
- ビジネスパーソン向けのトーン
- 絵文字は控えめに`,
  },
  linkedin: {
    name: 'LinkedIn',
    maxLength: 3000,
    guide: `- 300〜700文字程度
- プロフェッショナルなトーン
- 業界知見やインサイトを強調
- 冒頭にフック（統計データや問いかけ）
- 最後にCTAと記事リンク
- 関連ハッシュタグ3〜5個`,
  },
  instagram: {
    name: 'Instagram',
    maxLength: 2200,
    guide: `- キャプション形式、200〜400文字
- 冒頭1行で注目を引く
- ストーリー性を持たせる
- ハッシュタグは10〜15個（最後にまとめて）
- 「プロフィールのリンクから」等のCTA
- カルーセル投稿の各スライド内容案も含む`,
  },
  note: {
    name: 'note',
    maxLength: 5000,
    guide: `- 800〜1500文字程度の要約記事
- 記事の核心を伝えつつ、続きを読みたくなる構成
- 筆者の感想や補足を加えてオリジナリティを出す
- マガジン向けのフォーマット`,
  },
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
      include: {
        project: {
          select: {
            id: true, userId: true, guestId: true, title: true,
            targetAudience: true, intervieweeName: true, intervieweeCompany: true,
          },
        },
      },
    })

    if (!draft) {
      return NextResponse.json({ success: false, error: '見つかりませんでした' }, { status: 404 })
    }

    const ownerErr = checkOwnership(draft.project, userId, guestId)
    if (ownerErr) return ownerErr

    const body = await req.json()
    const platforms: string[] = body.platforms || ['twitter']
    const articleUrl: string = body.articleUrl || ''
    const tone: string = body.tone || 'professional'

    // バリデーション
    const validPlatforms = platforms.filter((p) => p in PLATFORM_SPECS)
    if (validPlatforms.length === 0) {
      return NextResponse.json(
        { success: false, error: '有効なプラットフォームを指定してください' },
        { status: 400 }
      )
    }

    const apiKey = getGeminiApiKey()
    const model = getModel()
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

    const platformSection = validPlatforms
      .map((p) => {
        const spec = PLATFORM_SPECS[p]
        return `### ${spec.name} (key: "${p}")
文字数上限: ${spec.maxLength}文字
${spec.guide}`
      })
      .join('\n\n')

    const articleSummary = draft.content.slice(0, 8000)

    const prompt = `あなたはSNSマーケティングの専門家です。以下のインタビュー記事をもとに、各プラットフォーム向けの投稿文を作成してください。

【トーン】${tone === 'casual' ? 'カジュアル・親しみやすい' : tone === 'humorous' ? 'ユーモラス・面白い' : 'プロフェッショナル・信頼感'}

【記事情報】
タイトル: ${draft.title || draft.project.title}
取材対象: ${draft.project.intervieweeName || ''}${draft.project.intervieweeCompany ? ` (${draft.project.intervieweeCompany})` : ''}
想定読者: ${draft.project.targetAudience || '一般'}
${articleUrl ? `記事URL: ${articleUrl}` : ''}

【プラットフォーム別要件】
${platformSection}

【記事内容】
${articleSummary}

【出力形式】
以下のJSON形式のみ出力してください。

{
  "posts": [
    {
      "platform": "twitter",
      "content": "投稿文テキスト",
      "hashtags": ["タグ1", "タグ2"],
      "characterCount": 120,
      "tip": "この投稿のポイント"
    }
  ]
}

twitter_thread の場合、content内の各ツイートは "---" で区切ってください。`

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 8192 },
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
      result = jsonMatch ? JSON.parse(jsonMatch[0]) : { posts: [] }
    } catch {
      result = { posts: [] }
    }

    return NextResponse.json({
      success: true,
      posts: result.posts || [],
    })
  } catch (e: any) {
    console.error('[interview] sns-posts error:', e?.message)
    return NextResponse.json(
      { success: false, error: e?.message || 'SNS投稿文の生成に失敗しました' },
      { status: 500 }
    )
  }
}
