import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
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

function safeJson(text: string) {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

export async function POST(_req: NextRequest, ctx: { params: { id: string } }) {
  try {
    await ensureSeoSchema()
    const articleId = ctx.params.id

    const article = await (prisma as any).seoArticle.findUnique({
      where: { id: articleId },
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

    const items = Array.isArray(out?.items) ? out.items : []

    // UI復元用に保存（schemaはbootstrapで追加）
    try {
      await (prisma as any).seoArticle.update({
        where: { id: articleId },
        data: { checkResults: items },
      })
    } catch {
      // ignore（保存失敗でもチェック結果は返す）
    }

    return NextResponse.json({ success: true, items })
  } catch (e: any) {
    const msg = e?.message || '不明なエラー'
    // 例外時でも必ずJSONで返す（res.json() を壊さない）
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}


