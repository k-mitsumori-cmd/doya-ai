import { geminiGenerateJson, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'

export type SeoPredictedBrief = {
  keywords: string[]
  persona: string
  searchIntent: string
  assumptions: string[]
}

export async function predictSeoBriefFromTitle(args: {
  title: string
  seedKeywords?: string[]
  tone?: string
}): Promise<SeoPredictedBrief> {
  const title = (args.title || '').trim()
  const seedKeywords = (args.seedKeywords || []).map((s) => s.trim()).filter(Boolean).slice(0, 10)

  const prompt = [
    'あなたは日本語SEO編集者です。',
    '与えられた「記事タイトル」から、想定読者と検索意図を推定し、記事設計の入力値を作ってください。',
    '',
    '制約:',
    '- 出力はJSONのみ',
    '- 日本語のみ',
    '- 断定しすぎず、現実的な仮説として書く',
    '- 読者の状況（立場/課題/制約）を具体的に',
    '- 検索意図は「知りたい/比較したい/手順が欲しい/失敗回避したい/購入検討」等の粒度で箇条書きにして良い',
    '',
    '入力:',
    `- 記事タイトル: ${title}`,
    seedKeywords.length ? `- 既に入力済みのキーワード: ${seedKeywords.join(', ')}` : '- 既に入力済みのキーワード: （なし）',
    args.tone ? `- トーン: ${args.tone}` : '- トーン: （未指定）',
    '',
    'JSONスキーマ:',
    '{',
    '  "keywords": ["..."],',
    '  "persona": "....",',
    '  "searchIntent": "....",',
    '  "assumptions": ["..."]',
    '}',
    '',
    '注意: keywordsは「検索で取りたい複合語/表記揺れ/関連語」を混ぜて5〜12個にする。',
  ].join('\n')

  const out = await geminiGenerateJson<SeoPredictedBrief>(
    { model: GEMINI_TEXT_MODEL_DEFAULT, prompt, generationConfig: { temperature: 0.3, maxOutputTokens: 1400 } },
    'SEO_BRIEF_JSON'
  )

  const keywords = Array.isArray(out?.keywords)
    ? out.keywords.map((s) => String(s).trim()).filter(Boolean).slice(0, 20)
    : []

  return {
    keywords,
    persona: String(out?.persona || '').trim(),
    searchIntent: String(out?.searchIntent || '').trim(),
    assumptions: Array.isArray(out?.assumptions) ? out.assumptions.map((s) => String(s).trim()).filter(Boolean).slice(0, 12) : [],
  }
}




