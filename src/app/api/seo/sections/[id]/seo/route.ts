import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { geminiGenerateText, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'
import { getSeoGenerationOwner } from '@/lib/seoArticleOwner'
import { reserveSeoToolCall, SeoToolRateLimitError } from '@/lib/seo-tool-admission'

export const runtime = 'nodejs'
export const maxDuration = 120

// POST: セクションをSEO強化
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const params = await ctx.params
    const id = params.id
    const owner = await getSeoGenerationOwner(req)
    if (!owner) return NextResponse.json({ success: false, code: 'LOGIN_REQUIRED', error: 'この生成操作にはログインしてください。' }, { status: 401 })

    const section = await prisma.seoSection.findFirst({ where: { id, article: { is: owner } }, include: { article: true } })
    if (!section) {
      return NextResponse.json({ success: false, error: 'セクションが見つかりません' }, { status: 404 })
    }

    if (!section.content) {
      return NextResponse.json({ success: false, error: 'セクションに本文がありません' }, { status: 400 })
    }

    // 記事情報を取得してキーワードを取得
    const article = section.article
    const keywords = article?.keywords as string[] || []
    await reserveSeoToolCall(owner.userId, 'article-text-tools')

    const prompt = `あなたはSEO専門家です。以下の見出しと本文を、SEO観点で強化してください。

【見出し】
${section.headingPath}

【現在の本文】
${section.content}

【対象キーワード】
${keywords.join(', ') || '（未設定）'}

【強化指示】
- キーワードを自然に含める（詰め込みすぎない）
- 見出しに対応した内容を網羅的に記述
- 読者の検索意図を満たす情報を追加
- 具体例や数字は元の本文・記事情報で確認できる場合のみ使い、存在しない事実を追加しない
- 文章の流れを自然に保つ

強化後の本文のみを出力してください。見出しは含めないでください。
**や*などの記号は使わないでください。`

    const enhanced = await geminiGenerateText({ model: GEMINI_TEXT_MODEL_DEFAULT, parts: [{ text: prompt }] })
    if (!enhanced?.trim()) return NextResponse.json({ success: false, error: 'AIから文章を取得できませんでした。時間をおいて再試行してください。' }, { status: 502 })

    const updated = await prisma.seoSection.updateMany({
      where: { id, article: { is: owner } },
      data: {
        content: enhanced,
        status: 'reviewed',
      },
    })
    if (updated.count !== 1) return NextResponse.json({ success: false, error: 'セクションが見つかりません' }, { status: 404 })

    return NextResponse.json({ success: true, content: enhanced })
  } catch (e: any) {
    if (e instanceof SeoToolRateLimitError) return NextResponse.json({ success: false, code: 'SEO_TEXT_DAILY_LIMIT', error: `本日のAI編集の運用上限（${e.limit}回）に達しました。明日お試しください。` }, { status: 429 })
    console.error('[seo sections/[id]/seo/route.ts] failed', e)
    return NextResponse.json({ success: false, error: 'セクションを強化できませんでした。時間をおいて再試行してください。' }, { status: 500 })
  }
}
