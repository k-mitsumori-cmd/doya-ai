import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { geminiGenerateText, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'

// POST: セクションをCV強化
export async function POST(req: NextRequest, ctx: { params: { id: string } }) {
  try {
    const id = ctx.params.id
    const { articleId, headingPath } = await req.json()

    const section = await prisma.seoSection.findUnique({ where: { id } })
    if (!section) {
      return NextResponse.json({ success: false, error: 'セクションが見つかりません' }, { status: 404 })
    }

    if (!section.content) {
      return NextResponse.json({ success: false, error: 'セクションに本文がありません' }, { status: 400 })
    }

    const prompt = `あなたはコンバージョン率最適化（CRO）の専門家です。以下の見出しと本文を、CV（コンバージョン）観点で強化してください。

【見出し】
${section.headingPath}

【現在の本文】
${section.content}

【強化指示】
- 読者の行動を促す文言を追加
- 比較表や選び方のポイントがあれば強調
- 「今すぐ」「無料」「限定」などの行動喚起ワードを適切に配置
- 読者の不安を解消する信頼性要素（実績、口コミ、保証など）を追加
- CTA（行動喚起）の文脈を自然に作る
- 過度に広告的にならないよう注意

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

