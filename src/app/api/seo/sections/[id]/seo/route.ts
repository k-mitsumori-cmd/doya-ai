import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { geminiGenerateText, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'

export const runtime = 'nodejs'
export const maxDuration = 120

// POST: セクションをSEO強化
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> | { id: string } }) {
  try {
    const params = 'then' in ctx.params ? await ctx.params : ctx.params
    const id = params.id
    const { articleId, headingPath } = await req.json()

    const section = await prisma.seoSection.findUnique({ where: { id } })
    if (!section) {
      return NextResponse.json({ success: false, error: 'セクションが見つかりません' }, { status: 404 })
    }

    if (!section.content) {
      return NextResponse.json({ success: false, error: 'セクションに本文がありません' }, { status: 400 })
    }

    // 記事情報を取得してキーワードを取得
    const article = await prisma.seoArticle.findUnique({ where: { id: section.articleId } })
    const keywords = article?.keywords as string[] || []

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
- 具体例や数字を追加して信頼性を高める
- 文章の流れを自然に保つ

強化後の本文のみを出力してください。見出しは含めないでください。
**や*などの記号は使わないでください。`

    const enhanced = await geminiGenerateText({ model: GEMINI_TEXT_MODEL_DEFAULT, parts: [{ text: prompt }] })

    await prisma.seoSection.update({
      where: { id },
      data: {
        content: enhanced || section.content,
        status: 'reviewed',
      },
    })

    return NextResponse.json({ success: true, content: enhanced })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || '不明なエラー' }, { status: 500 })
  }
}

