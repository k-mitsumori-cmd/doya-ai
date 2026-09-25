export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// ⚠️ AI生成を行うルートは maxDuration を必ず入れること。
//    未指定だとVercelの既定（十数秒）で打ち切られ、長い生成が本番でだけ504になる。
export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSeoArticleOwner } from '@/lib/seoArticleOwner'
import { ensureSeoSchema } from '@seo/lib/bootstrap'
import { geminiGenerateJson, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'

type CheckItem = {
  id: string
  category: 'regulation' | 'copy' | 'fact'
  severity: 'error' | 'warning' | 'info'
  title: string
  description: string
  location?: string
  suggestion?: string
  before?: string
  after?: string
}

const CheckResultSchema = z.object({
  items: z.array(z.object({
    id: z.string().min(1),
    category: z.enum(['regulation', 'copy', 'fact']),
    severity: z.enum(['error', 'warning', 'info']),
    title: z.string().min(1),
    description: z.string(),
    location: z.string().optional(),
    suggestion: z.string().optional(),
    before: z.string().optional(),
    after: z.string().optional(),
  })).max(30),
})

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const owner = await getSeoArticleOwner(_req)
    if (!owner) return NextResponse.json({ success: false, error: 'ログインが必要です' }, { status: 401 })
    await ensureSeoSchema()
    const p = await ctx.params
    const articleId = p.id

    const article = await (prisma as any).seoArticle.findFirst({
      where: { id: articleId, ...owner },
      include: { references: { orderBy: { createdAt: 'asc' } } },
    })
    if (!article) return NextResponse.json({ success: false, error: 'not found' }, { status: 404 })
    if (!article.finalMarkdown) {
      return NextResponse.json(
        { success: false, error: '本文がありません（先に記事生成を完了してください）' },
        { status: 400 }
      )
    }

    const refs = Array.isArray(article.references) ? article.references : []
    const sources = refs
      .slice(0, 8)
      .map((r: any) => ({
        url: r.url,
        title: r.title || null,
        summary: r.summary || null,
      }))

    const prompt = [
      'あなたは日本語の品質チェック担当です。',
      '以下の記事に対して、(1)レギュレーション (2)コピペ疑い (3)ファクトチェック の観点で問題点を抽出し、改善案を出してください。',
      '重要: 断定できない場合は「要確認」とし、根拠の取り方（一次情報/公式/出典）を提案してください。',
      '出力は必ずJSONのみ（前後に説明文を付けない）。',
      '',
      'JSON schema:',
      '{ "items": [ { "id":"...", "category":"regulation|copy|fact", "severity":"error|warning|info", "title":"...", "description":"...", "location":"...", "suggestion":"...", "before":"...", "after":"..." } ] }',
      '',
      `記事タイトル: ${article.title}`,
      `トーン: ${article.tone}`,
      `キーワード: ${Array.isArray(article.keywords) ? article.keywords.join(', ') : ''}`,
      '',
      '参考情報（ある場合）:',
      JSON.stringify({ sources }, null, 2),
      '',
      '記事本文（抜粋）:',
      String(article.finalMarkdown).slice(0, 16000),
      '',
      'ルール:',
      '- items は最大30件まで。重要度が高いものを優先。',
      '- category=copy は「同じ言い回しの連発」「不自然に整いすぎた定型」「固有名詞や数字列が続く」等を根拠に。',
      '- category=fact は「数値/日付/法律/制度/料金/比較の断定」を重点的に確認。',
      '- after は提案の書き換え例（短くてOK）。',
    ].join('\n')

    const out = await geminiGenerateJson<{ items?: CheckItem[] }>({
      model: GEMINI_TEXT_MODEL_DEFAULT,
      prompt,
      generationConfig: { temperature: 0.2, maxOutputTokens: 2800 },
    })

    const parsed = CheckResultSchema.safeParse(out)
    if (!parsed.success) return NextResponse.json({ success: false, error: 'チェック結果を読み取れませんでした。再度お試しください。' }, { status: 502 })
    const { items } = parsed.data
    try {
      await prisma.seoArticle.update({
        where: { id: articleId, ...owner, updatedAt: article.updatedAt },
        data: { checkResults: items },
      })
    } catch (e: any) {
      return NextResponse.json({ success: false, error: e?.code === 'P2025'
        ? 'チェック中に記事が変更されました。現在の内容で再度チェックしてください。'
        : 'チェック結果を保存できませんでした。再度お試しください。' }, { status: e?.code === 'P2025' ? 409 : 500 })
    }

    return NextResponse.json({ success: true, items })
  } catch (e: any) {
    console.error('[seo article check] failed', e)
    // 例外時でも必ずJSONで返す（res.json() を壊さない）
    return NextResponse.json({ success: false, error: '記事をチェックできませんでした。時間をおいて再試行してください。' }, { status: 500 })
  }
}


