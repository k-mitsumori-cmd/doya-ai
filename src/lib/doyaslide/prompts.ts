// ============================================
// ドヤスライド プロンプトビルダー
// ============================================
import { getStyleDirective, LOGO_POSITION_EN } from './constants'
import { getStructureTemplate } from './templates'
import type { LogoPosition, SlideStructure } from './types'

/** Gemini向け: スライド構成（JSON）生成プロンプト */
export function buildStructurePrompt(params: {
  topic: string
  docType: string
  customBrief?: string | null
  slideCount: number
  referenceText?: string | null
}): string {
  const { topic, docType, customBrief, slideCount, referenceText } = params
  const template = getStructureTemplate(docType)

  return [
    'あなたはプロのプレゼン構成作家です。以下の条件で、スライドの構成案を作ってください。',
    `テーマ: ${topic}`,
    `資料タイプの方針: ${template}`,
    customBrief ? `補足の要望: ${customBrief}` : '',
    referenceText
      ? `参考情報（最新の事実・数値・具体例の素材。一般論で埋めず、ここの情報を積極的に反映する）:\n${referenceText.slice(0, 5000)}`
      : '',
    `スライド枚数: ちょうど ${slideCount} 枚。`,
    '',
    '各スライドについて次を日本語で出力:',
    '- role: スライドの役割（例: 表紙, 課題, 解決策, 実績, 料金, まとめ, CTA）',
    '- headline: スライドの主役となる短い見出し（最大25文字程度・強く印象的に）',
    '- subText: 補足の短い説明（最大60文字程度。箇条書き2〜3点でも可）',
    '- visualPrompt: そのスライドのビジュアル方針（背景・モチーフ・色・雰囲気を具体的に。英語混在可）',
    '',
    `出力は次のJSON形式のみ: {"slides":[{"index":1,"role":"...","headline":"...","subText":"...","visualPrompt":"..."}, ...]} （${slideCount}件）`,
  ]
    .filter(Boolean)
    .join('\n')
}

/**
 * gpt-image-2向け: 1スライドをフル画像として描く画像プロンプト。
 * - 全スライド共通のスタイル指示を注入して統一感を出す
 * - ロゴ用のセーフゾーン（既定: 右上）を必ず空けるよう指示
 */
export function buildImagePrompt(params: {
  slide: { role?: string | null; headline?: string | null; subText?: string | null; visualPrompt: string }
  themeColor: string
  stylePreset: string
  hasLogo: boolean
  logoPosition: LogoPosition
  extraInstruction?: string // チャット修正の追記
}): string {
  const { slide, themeColor, stylePreset, hasLogo, logoPosition, extraInstruction } = params
  const style = getStyleDirective(stylePreset)
  const logoArea = LOGO_POSITION_EN[logoPosition] || 'top-right corner'

  const lines = [
    'Design ONE complete, polished presentation slide as a single full-bleed image (the whole slide is the artwork).',
    `Slide role: ${slide.role || 'content'}.`,
    slide.headline ? `Headline text to render large and legible (Japanese): "${slide.headline}".` : '',
    slide.subText ? `Supporting text (Japanese), smaller: "${slide.subText}".` : '',
    `Visual direction: ${slide.visualPrompt}.`,
    `Overall style: ${style}.`,
    `Primary brand color: ${themeColor}. Use it as the dominant accent for a cohesive deck.`,
    'Keep the design consistent with a single cohesive deck (same color system, typography feel, margins).',
    'Text must be spelled correctly, crisp, well-kerned, and clearly readable. Keep on-image text short.',
    hasLogo
      ? `IMPORTANT: leave the ${logoArea} completely EMPTY — no text, no graphics, no important elements there — reserve a clean rectangular safe zone for a logo to be placed later.`
      : '',
    extraInstruction ? `Additional adjustment requested by the user: ${extraInstruction}.` : '',
    'High quality, professional, visually striking. No watermark. No UI chrome. No borders around the slide.',
  ]
  return lines.filter(Boolean).join('\n')
}

/** Gemini向け: URL内容からタイトル・狙いを提案するプロンプト */
export function buildAnalyzePrompt(scraped: {
  title: string
  description: string
  text: string
}): string {
  return [
    'あなたはプレゼン資料の企画者です。次のWebページの内容を読み、その内容を題材にしたプレゼン資料の「タイトル案」と「狙い(brief)」を日本語で作ってください。',
    `ページタイトル: ${scraped.title}`,
    scraped.description ? `説明: ${scraped.description}` : '',
    `本文抜粋:\n${scraped.text.slice(0, 4000)}`,
    '',
    '次のJSONのみ出力: {"title":"魅力的な資料タイトル(30文字以内)","brief":"資料の狙い・含めたい要点(120文字以内)"}',
  ]
    .filter(Boolean)
    .join('\n')
}

/** Gemini向け: チャット修正の意図分解プロンプト */
export function buildChatEditPrompt(params: {
  userMessage: string
  slide: { role?: string | null; headline?: string | null; subText?: string | null; visualPrompt: string }
}): string {
  const { userMessage, slide } = params
  return [
    'あなたはスライド編集アシスタントです。ユーザーの指示を解釈し、対象スライドへの変更を決めます。',
    `現在のスライド: role=${slide.role || ''} / headline=${slide.headline || ''} / subText=${slide.subText || ''}`,
    `現在のビジュアル方針: ${slide.visualPrompt}`,
    `ユーザーの指示: ${userMessage}`,
    '',
    '変更が必要な項目だけを返してください（不要な項目は省略）。',
    '- reply: ユーザーへの短い返答（日本語・1文）',
    '- headline: 見出しを変える場合のみ',
    '- subText: 補足を変える場合のみ',
    '- visualPrompt: 色/背景/雰囲気など見た目を変える場合のみ（更新後の完全な方針を返す）',
    '- logoPosition: ロゴ位置変更の指示があれば top-right/top-left/bottom-right/bottom-left/top-center/bottom-center',
    '- logoSize: ロゴサイズ変更の指示があれば S/M/L',
    '',
    '出力は次のJSON形式のみ: {"reply":"...","headline":"...","subText":"...","visualPrompt":"...","logoPosition":"...","logoSize":"..."}',
  ].join('\n')
}
