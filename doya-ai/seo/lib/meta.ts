import { geminiGenerateJson, GEMINI_TEXT_MODEL_DEFAULT } from '@seo/lib/gemini'

export type SeoMeta = {
  metaTitle: string
  metaDescription: string
  slug: string
  ogTitle: string
  ogDescription: string
  faqSchemaJsonLd?: string
}

function clampText(s: string, max = 8000): string {
  if (!s) return ''
  return s.length > max ? `${s.slice(0, max)}\n...(truncated)` : s
}

export async function generateSeoMeta(args: {
  title: string
  keywords: string[]
  markdown?: string
}): Promise<SeoMeta> {
  const prompt = [
    'You are a Japanese SEO editor.',
    'Generate metadata for the article.',
    'Output STRICT JSON only. No markdown. No extra text.',
    '',
    'Rules:',
    '- metaTitle: 28-34 Japanese chars (approx), includes main keyword naturally',
    '- metaDescription: 90-120 Japanese chars, benefits + specificity, no hype',
    '- slug: lowercase, hyphen-separated, ASCII only (e.g., llmo-seo-guide)',
    '- ogTitle/ogDescription: can reuse but slightly more share-friendly',
    '- If the article contains an FAQ section, include faqSchemaJsonLd as JSON-LD string (FAQPage)',
    '',
    `Title: ${args.title}`,
    `Keywords: ${args.keywords.join(', ')}`,
    args.markdown ? `Article (truncated):\n${clampText(args.markdown, 9000)}` : '',
    '',
    'JSON schema:',
    '{ "metaTitle":"", "metaDescription":"", "slug":"", "ogTitle":"", "ogDescription":"", "faqSchemaJsonLd":"" }',
  ]
    .filter(Boolean)
    .join('\n')

  return await geminiGenerateJson<SeoMeta>({
    model: GEMINI_TEXT_MODEL_DEFAULT,
    prompt,
    generationConfig: { temperature: 0.3, maxOutputTokens: 1400 },
  })
}




