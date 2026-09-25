export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// ⚠️ AI生成を行うルートは maxDuration を必ず入れること。
//    未指定だとVercelの既定（十数秒）で打ち切られ、長い生成が本番でだけ504になる。
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { geminiGenerateText, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'
import { getSeoArticleOwner } from '@/lib/seoArticleOwner'

// POST: セクションをCV強化
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const id = (await ctx.params).id
    const owner = await getSeoArticleOwner(req)
    if (!owner) return NextResponse.json({ success: false, error: 'ログインまたはゲスト認証が必要です' }, { status: 401 })

    const section = await prisma.seoSection.findFirst({ where: { id, article: { is: owner } } })
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

    const updated = await prisma.seoSection.updateMany({
      where: { id, article: { is: owner } },
      data: {
        content: enhanced || section.content,
        status: 'reviewed',
      },
    })
    if (updated.count !== 1) return NextResponse.json({ success: false, error: 'セクションが見つかりません' }, { status: 404 })

    return NextResponse.json({ success: true, content: enhanced })
  } catch (e: any) {
    console.error('[seo sections/[id]/cv/route.ts] failed', e)
    return NextResponse.json({ success: false, error: 'セクションを強化できませんでした。時間をおいて再試行してください。' }, { status: 500 })
  }
}
