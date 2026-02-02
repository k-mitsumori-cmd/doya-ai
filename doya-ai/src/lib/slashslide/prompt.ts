import type { SlashSlideGenerateRequest, SlashSlideTheme } from './types'

export const THEME_PRESETS: Record<string, SlashSlideTheme> = {
  コンサルブルー: {
    name: 'コンサルブルー',
    background: '#0B1220',
    primary: '#3B82F6',
    accent: '#F59E0B',
    fontFamily: 'Noto Sans JP',
  },
  モダングリーン: {
    name: 'モダングリーン',
    background: '#071A10',
    primary: '#22C55E',
    accent: '#38BDF8',
    fontFamily: 'Noto Sans JP',
  },
  プレミアムブラック: {
    name: 'プレミアムブラック',
    background: '#0B0B0B',
    primary: '#E5E7EB',
    accent: '#A855F7',
    fontFamily: 'Noto Sans JP',
  },
  ヘルスケア: {
    name: 'ヘルスケア',
    background: '#06232B',
    primary: '#06B6D4',
    accent: '#F472B6',
    fontFamily: 'Noto Sans JP',
  },
  リクルート: {
    name: 'リクルート',
    background: '#0A1020',
    primary: '#F97316',
    accent: '#A3E635',
    fontFamily: 'Noto Sans JP',
  },
}

function clampBullets(bullets: string[]): string[] {
  return bullets
    .map((s) => String(s || '').trim())
    .filter(Boolean)
    .slice(0, 6)
    .map((s) => (s.length > 70 ? `${s.slice(0, 67)}…` : s))
}

export function buildSlashSlidePrompt(input: SlashSlideGenerateRequest, theme: SlashSlideTheme): string {
  const reference = (input.referenceText || '').trim()
  const constraints = (input.constraints || '').trim()

  return [
    'You are a senior Japanese marketing consultant and presentation designer.',
    'Your job is to create a high-quality slide deck outline that can be converted into Google Slides.',
    '',
    'Return STRICT JSON only. No markdown, no code fences, no extra text.',
    '',
    'Schema (types):',
    '{',
    '  "deckTitle": string,',
    '  "deckSubtitle": string,',
    '  "language": "ja",',
    '  "theme": { "name": string, "background": "#RRGGBB", "primary": "#RRGGBB", "accent": "#RRGGBB", "fontFamily": string },',
    '  "slides": [',
    '    {',
    '      "type": "title" | "section" | "content",',
    '      "title": string,',
    '      "subtitle": string,',
    '      "bullets": string[],',
    '      "speakerNotes": string,',
    '      "visualSuggestion": string',
    '    }',
    '  ]',
    '}',
    '',
    'Constraints:',
    `- language: Japanese`,
    `- docType: ${input.docType}`,
    `- audience: ${input.audience}`,
    `- goal: ${input.goal}`,
    `- tone: ${input.tone}`,
    `- slideCount: exactly ${input.slideCount} slides`,
    `- theme must be exactly: ${JSON.stringify(theme)}`,
    `- slide[0] must be type="title" (title + subtitle).`,
    `- Use 1-2 "section" slides to structure the story.`,
    `- "content" slides should have 3-6 bullets; each bullet <= 70 chars.`,
    `- Keep claims realistic; avoid hallucinating specific numbers unless provided in reference.`,
    constraints ? `- Additional constraints: ${constraints}` : '',
    '',
    reference
      ? [
          'Reference material (you must use this; do not invent facts):',
          '---',
          reference.slice(0, 18000),
          '---',
          '',
        ].join('\n')
      : '',
    'Important:',
    '- Output COMPLETE JSON (no truncation).',
    '- Ensure slides array length is exactly slideCount.',
    '- For bullets, prefer concrete, action-oriented phrasing.',
  ]
    .filter(Boolean)
    .join('\n')
}

export function postProcessDeckJson(deck: any) {
  if (!deck || typeof deck !== 'object') return deck
  if (Array.isArray(deck.slides)) {
    deck.slides = deck.slides.map((s: any, idx: number) => {
      const slide = typeof s === 'object' && s ? { ...s } : { type: 'content', title: `Slide ${idx + 1}` }
      if (Array.isArray(slide.bullets)) slide.bullets = clampBullets(slide.bullets)
      return slide
    })
  }
  return deck
}





