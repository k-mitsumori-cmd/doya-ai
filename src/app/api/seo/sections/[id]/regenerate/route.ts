import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { geminiGenerateText, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'
import { getSeoArticleOwner } from '@/lib/seoArticleOwner'

export const runtime = 'nodejs'
export const maxDuration = 120

// POST: セクションを再生成
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const params = await ctx.params
    const id = params.id
    const owner = await getSeoArticleOwner(req)
    if (!owner) return NextResponse.json({ success: false, error: 'ログインまたはゲスト認証が必要です' }, { status: 401 })
    const body = await req.json().catch(() => ({}))

    const section = await prisma.seoSection.findFirst({ where: { id, article: { is: owner } }, include: { article: true } })
    if (!section) {
      return NextResponse.json({ success: false, error: 'セクションが見つかりません' }, { status: 404 })
    }

    // 記事情報を取得
    const article = section.article
    const keywords = (article?.keywords as string[]) || []
    const heading = body.headingPath || section.headingPath || ''

    const prompt = `あなたはプロのSEOライターです。以下の見出しに対応する本文を新しく生成してください。

【記事タイトル】
${article?.title || ''}

【見出し】
${heading}

【対象キーワード】
${keywords.join(', ') || '（未設定）'}

【指示】
- 見出しに対応した内容を網羅的に記述してください
- 読者の検索意図を満たす具体的な情報を提供してください
- 具体例や数字を含めて信頼性を高めてください
- 日本語で自然な文章にしてください
- 800〜1500文字程度で記述してください
- **や*などのMarkdown装飾記号は使わないでください

本文のみを出力してください。見出しは含めないでください。`

    const regenerated = await geminiGenerateText({
      model: GEMINI_TEXT_MODEL_DEFAULT,
      parts: [{ text: prompt }],
      generationConfig: { temperature: 0.5, maxOutputTokens: 4096 },
    })

    if (!regenerated?.trim()) {
      return NextResponse.json({ success: false, error: 'セクションの再生成に失敗しました' }, { status: 500 })
    }

    const updated = await prisma.seoSection.updateMany({
      where: { id, article: { is: owner } },
      data: {
        content: regenerated,
        status: 'reviewed',
      },
    })
    if (updated.count !== 1) return NextResponse.json({ success: false, error: 'セクションが見つかりません' }, { status: 404 })

    return NextResponse.json({ success: true, content: regenerated })
  } catch (e: any) {
    console.error('[seo sections/[id]/regenerate/route.ts] failed', e)
    return NextResponse.json({ success: false, error: 'セクションを再生成できませんでした。時間をおいて再試行してください。' }, { status: 500 })
  }
}
