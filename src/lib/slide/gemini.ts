import { geminiGenerateJson, GEMINI_TEXT_MODEL_DEFAULT } from '../../../seo/lib/gemini'
import { buildSlashSlidePrompt, postProcessDeckJson, THEME_PRESETS } from './prompt'
import {
  SlashSlideDeckSchema,
  SlashSlideGenerateRequestSchema,
  SlideGenerateRequest,
  SlideSpec,
} from './types'

// =============================================================================
// 高機能版: SlashSlideDeck 形式
// =============================================================================
export async function slashslideGenerateDeck(raw: unknown) {
  const input = SlashSlideGenerateRequestSchema.parse(raw)
  const theme = input.customTheme || THEME_PRESETS[input.themePreset] || THEME_PRESETS['コンサルブルー']

  const model =
    process.env.SLIDE_GEMINI_MODEL ||
    process.env.SEO_GEMINI_TEXT_MODEL ||
    GEMINI_TEXT_MODEL_DEFAULT ||
    'gemini-3-pro-preview'

  const prompt = buildSlashSlidePrompt(input, theme)
  const deckAny = await geminiGenerateJson<any>(
    {
      model,
      prompt,
      generationConfig: { temperature: 0.5, maxOutputTokens: 65536 },
    },
    'SlashSlideDeck'
  )

  const normalized = postProcessDeckJson(deckAny)
  const deck = SlashSlideDeckSchema.parse(normalized)
  return deck
}

// =============================================================================
// 簡易版: SlideSpec 形式（UI/API用）
// =============================================================================
function buildSimpleSlidePrompt(input: SlideGenerateRequest): string {
  const purposeMap: Record<string, string> = {
    proposal: '提案資料',
    meeting: 'ミーティング資料',
    sales: '営業資料',
    recruit: '採用資料',
    seminar: 'セミナー/ウェビナー資料',
    other: '資料',
  }
  const docType = purposeMap[input.slidePurpose] || '資料'

  return [
    'You are a senior Japanese presentation designer.',
    'Output STRICT JSON only. No markdown. No code fences.',
    '',
    'Schema:',
    '{ "slides": [ { "title": string, "elements": [ { "type": "text" | "bullets", "content"?: string, "items"?: string[] } ] } ] }',
    '',
    `Create exactly ${input.slideCount} slides for: ${input.topic}`,
    `Document type: ${docType}`,
    `Theme color (for reference): ${input.themeColor}`,
    '',
    input.referenceText ? `Reference:\n${input.referenceText.slice(0, 12000)}` : '',
    '',
    'Important:',
    '- Output COMPLETE JSON.',
    '- slides array length = slideCount.',
    '- Each slide has 1-2 elements.',
    '- bullets type should have 3-6 items, each < 70 chars.',
    '- Language: Japanese.',
  ]
    .filter(Boolean)
    .join('\n')
}

export async function generateSlideSpec(input: SlideGenerateRequest): Promise<{ slides: SlideSpec[] }> {
  const model =
    process.env.SLIDE_GEMINI_MODEL ||
    process.env.SEO_GEMINI_TEXT_MODEL ||
    GEMINI_TEXT_MODEL_DEFAULT ||
    'gemini-3-pro-preview'

  const prompt = buildSimpleSlidePrompt(input)
  const result = await geminiGenerateJson<{ slides: any[] }>(
    {
      model,
      prompt,
      generationConfig: { temperature: 0.5, maxOutputTokens: 32000 },
    },
    'SlideSpec'
  )

  // 正規化
  const slides: SlideSpec[] = (result.slides || []).map((s: any, i: number) => ({
    title: String(s?.title || `Slide ${i + 1}`),
    elements: Array.isArray(s?.elements)
      ? s.elements.map((e: any) => ({
          type: e?.type === 'bullets' ? 'bullets' : 'text',
          content: e?.content,
          items: Array.isArray(e?.items) ? e.items.map(String) : undefined,
        }))
      : [],
  }))

  return { slides }
}

