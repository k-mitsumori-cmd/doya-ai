import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { geminiGenerateJson, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BodySchema = z.object({
  keyword: z.string().min(1).max(200).optional(),
  keywords: z.array(z.string().min(1).max(200)).optional(),
  articleType: z.string().optional(),
  targetChars: z.number().optional(),
  tone: z.string().optional(),
  count: z.number().int().min(1).max(10).optional(),
})

function sanitizeTitle(t: string): string {
  return String(t || '')
    .replace(/^[\s\-–—•・]*\d+[\)\]\.:\s\-–—•・]+/, '') // "1. " など
    .replace(/^["'「『]+|["'」』]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function fallbackTitles(keyword: string, count: number): string[] {
  const k = keyword.trim()
  const base = [
    `${k}とは？初心者でもわかる基礎と選び方`,
    `${k}の選び方｜失敗しないチェックリスト`,
    `${k}比較｜料金・特徴・向いている人を整理`,
    `【2026年版】${k}おすすめと比較ポイント`,
    `${k}のメリット・デメリットをわかりやすく解説`,
    `${k}導入の手順｜社内で失敗しない進め方`,
    `${k}でよくある失敗例と対策`,
    `${k}の最新動向（2026）と注目ポイント`,
  ]
  return base.slice(0, count)
}

export async function POST(req: NextRequest) {
  try {
    const body = BodySchema.parse(await req.json())
    const primary = String(body.keyword || body.keywords?.[0] || '').trim()
    if (!primary) {
      return NextResponse.json({ success: false, error: 'keyword が必要です。' }, { status: 400 })
    }

    const count = Math.max(1, Math.min(10, Number(body.count || 6)))
    const type = String(body.articleType || '').trim()
    const tone = String(body.tone || '').trim()
    const targetChars = Number(body.targetChars || 0) || undefined
    const keywords = Array.isArray(body.keywords) ? body.keywords.map(String).map((s) => s.trim()).filter(Boolean) : []

    const model =
      process.env.SEO_GEMINI_TEXT_MODEL_TITLE_SUGGESTIONS ||
      process.env.SEO_GEMINI_TEXT_MODEL ||
      GEMINI_TEXT_MODEL_DEFAULT

    const prompt = [
      'あなたは日本語のSEO記事タイトルのプロです。',
      '以下の条件をすべて守り、タイトル候補を指定件数だけ提案してください。',
      '',
      '【必須ルール】',
      `- 主キーワード「${primary}」を必ず含める（表記ゆれを避ける）`,
      '- 誇張しすぎない（断定・煽り・最安保証などは禁止）',
      '- 2024年/2025年は使わない。年を入れる場合は「2026年版」または「2026」',
      '- 句読点や記号は最小限（読みやすさ優先）',
      '- 6案すべて角度を変える（比較/選び方/注意点/入門/具体例/チェックリストなど）',
      '',
      '【入力】',
      `- 主キーワード: ${primary}`,
      keywords.length ? `- 関連キーワード: ${keywords.slice(0, 12).join(' / ')}` : '- 関連キーワード: （なし）',
      type ? `- 記事タイプ: ${type}` : '- 記事タイプ: （未指定）',
      tone ? `- トーン: ${tone}` : '- トーン: （未指定）',
      targetChars ? `- 目標文字数: ${targetChars}` : '- 目標文字数: （未指定）',
      '',
      '【出力形式】',
      'JSONのみで返す。',
      `{"titles": string[] }`,
      `- titles は必ず ${count} 個`,
    ].join('\n')

    const out = await geminiGenerateJson<{ titles: string[] }>(
      {
        model,
        generationConfig: { temperature: 0.55, maxOutputTokens: 1024 },
        prompt,
      },
      'TitleSuggestions'
    )

    const raw = Array.isArray(out?.titles) ? out.titles : []
    const titles = Array.from(new Set(raw.map(sanitizeTitle).filter(Boolean))).slice(0, count)
    const merged = titles.length >= count ? titles : Array.from(new Set([...titles, ...fallbackTitles(primary, count)])).slice(0, count)

    return NextResponse.json({ success: true, titles: merged })
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e?.message || '不明なエラー' },
      { status: 500 }
    )
  }
}

