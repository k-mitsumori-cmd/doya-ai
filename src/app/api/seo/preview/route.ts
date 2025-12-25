import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { geminiGenerateJson, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'
import { SeoOutlineSchema, type SeoOutline } from '@seo/lib/types'

const BodySchema = z.object({
  mainKeyword: z.string().min(1).max(100),
  relatedKeywords: z.array(z.string().min(1).max(100)).max(30).optional().default([]),
  persona: z.string().max(5000).optional().default(''),
  tone: z.string().max(50).optional().default('丁寧'),
  targetChars: z.number().int().min(1000).max(60000).optional().default(10000),
  llmoOptions: z
    .object({
      tldr: z.boolean().optional(),
      conclusionFirst: z.boolean().optional(),
      faq: z.boolean().optional(),
      glossary: z.boolean().optional(),
      comparison: z.boolean().optional(),
      quotes: z.boolean().optional(),
      templates: z.boolean().optional(),
      objections: z.boolean().optional(),
    })
    .optional(),
})

function computeMinSections(targetChars: number): number {
  const t = Math.max(10000, Number(targetChars || 10000))
  const min = Math.ceil(t / 2800)
  return Math.max(12, Math.min(28, min))
}

function ensureMinSections(outline: SeoOutline, targetChars: number): SeoOutline {
  const minSections = computeMinSections(targetChars)
  if (outline.sections.length >= minSections) return outline

  const extras: SeoOutline['sections'] = []
  const templates = [
    { h2: '比較表で一気に整理：選び方（用途別）', intentTag: '比較' },
    { h2: '導入前に必ず確認すべきチェックリスト（コピペ可）', intentTag: '手順' },
    { h2: 'よくある失敗例と回避策（現場で起きがち）', intentTag: '失敗例' },
    { h2: '社内説明・稟議を通すための説明テンプレ（例文）', intentTag: 'テンプレ' },
    { h2: 'よくある質問（FAQ）', intentTag: 'FAQ' },
  ]
  let idx = 0
  while (outline.sections.length + extras.length < minSections) {
    const t = templates[idx % templates.length]
    extras.push({
      h2: t.h2,
      intentTag: t.intentTag,
      plannedChars: 2500,
      h3: [],
      h4: {},
    })
    idx++
  }

  return { ...outline, sections: [...outline.sections, ...extras] }
}

export async function POST(req: NextRequest) {
  try {
    const body = BodySchema.parse(await req.json())
    const main = body.mainKeyword.trim()
    const related = (body.relatedKeywords || []).map((s) => s.trim()).filter(Boolean).slice(0, 20)
    const seedKeywords = [main, ...related].slice(0, 20)

    const llmo = body.llmoOptions || {}
    const llmoFlags = [
      llmo.tldr !== false ? 'TL;DR（要約）' : null,
      llmo.conclusionFirst !== false ? '結論ファースト' : null,
      llmo.faq !== false ? 'FAQ' : null,
      llmo.glossary !== false ? '用語集' : null,
      llmo.comparison ? '比較' : null,
      llmo.quotes ? '引用/根拠' : null,
      llmo.templates ? 'テンプレ' : null,
      llmo.objections ? '反論/懸念つぶし' : null,
    ].filter(Boolean)

    const prompt = [
      'あなたは日本語SEO編集長です。',
      '目的: 入力されたキーワードから、生成前プレビュー用の「検索意図・想定読者・見出し構成」を作ってください。',
      '',
      '重要:',
      '- 日本語のみ',
      '- 上位記事で抜けが出やすい論点（比較/選び方/料金/導入手順/失敗回避/FAQ）を落とさない',
      '- LLMO（AI検索）を意識して、結論→理由→具体例→比較→FAQの流れに寄せる',
      '- 見出しはH2を中心に、必要ならH3を付ける',
      '',
      `入力:`,
      `- メインKW: ${main}`,
      related.length ? `- 関連KW: ${related.join(', ')}` : `- 関連KW: （なし）`,
      body.persona ? `- 想定読者（任意）: ${body.persona}` : `- 想定読者（任意）: （未指定）`,
      body.tone ? `- トーン: ${body.tone}` : `- トーン: （未指定）`,
      `- 目標文字数: ${body.targetChars}`,
      llmoFlags.length ? `- 付与したい構造（LLMO）: ${llmoFlags.join(' / ')}` : `- 付与したい構造（LLMO）: （デフォルト）`,
      '',
      '出力JSONスキーマ:',
      '{',
      '  "persona": "....",',
      '  "searchIntent": "....",',
      '  "keywords": ["..."],',
      '  "outline": { ...SeoOutlineSchema... }',
      '}',
      '',
      'SeoOutlineSchema（outline）の要件:',
      '- sections はH2配列（min 3）',
      '- plannedChars は1セクション 1800〜3000 を目安',
      '- internalLinkIdeas / faq / glossary / diagramIdeas も可能な範囲で提案する',
      '',
      '注意: keywords は 5〜12個、表記揺れ・関連語を混ぜる。',
    ].join('\n')

    const raw = await geminiGenerateJson<any>(
      {
        model: GEMINI_TEXT_MODEL_DEFAULT,
        prompt,
        generationConfig: { temperature: 0.3, maxOutputTokens: 3500 },
      },
      'SEO_PREVIEW_JSON'
    )

    const outline = ensureMinSections(SeoOutlineSchema.parse(raw?.outline || {}), body.targetChars)
    const persona = String(raw?.persona || body.persona || '').trim()
    const searchIntent = String(raw?.searchIntent || '').trim()
    const keywords = Array.isArray(raw?.keywords)
      ? raw.keywords.map((s: any) => String(s).trim()).filter(Boolean).slice(0, 20)
      : seedKeywords.slice(0, 12)

    return NextResponse.json({
      success: true,
      preview: {
        persona,
        searchIntent,
        keywords,
        outline,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || '不明なエラー' }, { status: 400 })
  }
}


