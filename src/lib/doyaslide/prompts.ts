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
    'あなたは一流コンサルティングファーム品質の資料を作るプレゼン構成作家です。以下の条件で、「きちんとしたビジネス資料」のスライド構成案を作ってください。',
    `テーマ: ${topic}`,
    `資料タイプの方針: ${template}`,
    customBrief ? `補足の要望: ${customBrief}` : '',
    referenceText
      ? `参考情報（最新の事実・数値・具体例の素材。一般論で埋めず、ここの情報を積極的に反映する）:\n${referenceText.slice(0, 5000)}`
      : '',
    `スライド枚数: ちょうど ${slideCount} 枚。`,
    slideCount >= 8
      ? 'ビジネス向け資料（営業/提案/採用/セミナー/社内共有など）の場合、2枚目に「目次」を入れる。'
      : '',
    '1スライド=1メッセージ。各スライドは「結論を言い切るリード文」と「それを支える具体的な本文」で構成する（ポスターの様な煽り文句の羅列にしない）。',
    'URL・メールアドレス・電話番号・SNSアカウントは、参考情報や要望に明記がない限り創作しない（例: example.com のような偽リンクを入れない）。連絡先が無い場合は「詳しくはお問い合わせください」等の一般的な誘導文にする。',
    '',
    '各スライドについて次を日本語で出力:',
    '- role: スライドの役割（例: 表紙, 目次, 課題, 解決策, 実績, 料金, まとめ, CTA）',
    '- headline: スライドタイトル（最大20文字。本文ページは内容を要約した名詞句、表紙はキャッチーに）',
    '- subText: スライドの中身。1行目=そのスライドの結論を言い切るリード文（30〜40文字）。2行目以降=本文の箇条書き3〜5点（各行「・ラベル｜説明」形式で15〜25文字。目次は章タイトルの列挙、表紙・セクション扉はサブタイトル1行のみ）',
    '- visualPrompt: そのスライドの本文レイアウト指示（例: 3カラムのカード、左テキスト+右図解、プロセス図、棒グラフ風、比較表 など。図解・構造のみを書く）。【重要】色・配色は絶対に指定しない（配色はテーマカラーで全スライド統一されるため、個別の色指定は統一感を壊す）。QRコード・バーコード等のコードは絶対に含めない（CTA/最終ページでも不可）',
    '',
    `出力は次のJSON形式のみ: {"slides":[{"index":1,"role":"...","headline":"...","subText":"...","visualPrompt":"..."}, ...]} （${slideCount}件）`,
  ]
    .filter(Boolean)
    .join('\n')
}

/**
 * gpt-image-2向け: 1スライドをフル画像として描く画像プロンプト。
 * - LayerX等の日本のBtoB企業資料に倣った「きちんとした資料」のデザインシステムを全スライドに適用
 * - ページ種別（表紙/セクション扉/本文/まとめ）でレイアウト定型を切り替える
 * - 配色はテーマカラー＋スタイルのみで決め、visualPrompt内の色指定は無視させる（デッキ内の統一感）
 * - ロゴ用のセーフゾーン（既定: 右上）を必ず空けるよう指示
 */
export function buildImagePrompt(params: {
  slide: { role?: string | null; headline?: string | null; subText?: string | null; visualPrompt: string }
  themeColor: string
  stylePreset: string
  hasLogo: boolean
  logoPosition: LogoPosition
  extraInstruction?: string // チャット修正の追記
  pageNumber?: number // 本文ページ右下に小さく入れるページ番号（表紙では未使用）
}): string {
  const { slide, themeColor, stylePreset, hasLogo, logoPosition, extraInstruction, pageNumber } = params
  const style = getStyleDirective(stylePreset)
  const logoArea = LOGO_POSITION_EN[logoPosition] || 'top-right corner'

  const role = slide.role || ''
  const isCover = /表紙|タイトル|カバー|cover/i.test(role)
  const isDivider = /扉|セクション|章/.test(role)
  const isAgenda = /目次|アジェンダ|agenda|contents/i.test(role)

  // ページ種別ごとのレイアウト定型（きちんとした企業資料の型）
  let layout: string
  if (isCover) {
    layout = [
      'COVER SLIDE layout: a full-bleed brand-colored background treatment is allowed here.',
      'Compose with at most 4 elements: one large bold title (left-aligned or center-left), one small subtitle line below it, and one abstract brand motif. Plenty of empty space. No bullet lists, no dense text.',
    ].join(' ')
  } else if (isDivider) {
    layout = [
      'SECTION DIVIDER layout: full-bleed brand-colored background, one oversized section number, and the section title in large type. Nothing else — maximum 3 elements, very spacious.',
    ].join(' ')
  } else if (isAgenda) {
    layout = [
      'AGENDA (table of contents) layout: clean light background. The word and items laid out as a numbered list with large numerals in the accent color and item titles in dark text, generous line spacing, left-aligned on a strict grid.',
    ].join(' ')
  } else {
    layout = [
      'BODY SLIDE layout — follow this fixed corporate-document template:',
      '(1) Slide title at the TOP-LEFT, left-aligned, bold, dark (not pure black), moderate size (about 1/12 of slide height — NOT a giant poster headline), with a thin accent-colored underline or a small accent keyword.',
      '(2) Directly under the title, the one-line lead message in smaller regular weight.',
      '(3) The main body area fills the middle: arrange the bullet items as a structured grid (2–3 columns of rounded cards, or the diagram described in the Visual direction). Each item = small pill-shaped label + short body text in SMALL type.',
      '(4) A thin baseline rule near the bottom as footer.',
      'Background: plain white or very light neutral (unless the style directive explicitly defines a consistent dark background). Title row, margins and footer must look identical across the whole deck.',
      'Uniform margins (~6% of slide width) on all four sides; align everything to a strict grid; keep roughly 30% of the slide as whitespace.',
    ].join(' ')
  }

  const lines = [
    'Design ONE page of a professional Japanese B2B corporate slide deck as a single full-bleed image (the whole slide is the artwork). It must look like a page from a real, well-crafted company document (like a SaaS company deck) — NOT a poster, NOT an advertisement.',
    `Slide role: ${role || 'content'}.`,
    layout,
    slide.headline ? `Slide title (Japanese): "${slide.headline}".` : '',
    slide.subText
      ? `Slide content (Japanese) — first line is the lead message, remaining lines are the body items; render them faithfully with this hierarchy (title > lead > labels > body, body text small but readable): "${slide.subText}".`
      : '',
    `Visual direction for the body area (layout/diagram only): ${slide.visualPrompt}.`,
    `Style flavor: ${style}.`,
    // デッキ内の配色統一: テーマカラー＋スタイル以外の色をAIに発明させない
    `STRICT DECK COLOR SYSTEM: the accent color is ${themeColor}. Use ONLY: this accent color (plus its lighter tints), one dark neutral for text, and white/light-gray surfaces — unless the style flavor above explicitly defines its own consistent background. If the Visual direction mentions any other colors, IGNORE those color mentions and keep this exact palette. Every slide of this deck uses the identical palette, typography and margins.`,
    'Typography: one modern Japanese gothic (sans-serif) family only, clear 3–4 level hierarchy. Flat vector-style diagrams (rounded rectangles, simple arrows, pill labels) — no 3D, no drop shadows, no photographic collage, no mascots.',
    'All text must be spelled exactly as given, crisp, well-kerned, clearly readable. Do not add any extra sentences that are not provided above.',
    !isCover && !isDivider && pageNumber
      ? `Put a small page number "${pageNumber}" in light gray at the bottom-right, like a real document.`
      : '',
    hasLogo
      ? `IMPORTANT: leave the ${logoArea} completely EMPTY — no text, no graphics, no important elements there — reserve a clean rectangular safe zone for a logo to be placed later.`
      : '',
    extraInstruction ? `Additional adjustment requested by the user: ${extraInstruction}.` : '',
    // AI生成のQR/バーコードは読み取れず偽物になるため、一切描かせない（全スライド共通の禁止）
    'Absolutely do NOT include any QR code, barcode, or scannable matrix/dot code anywhere in the image — AI-generated codes are non-functional and must never appear.',
    // 偽/無効なURL・連絡先を勝手に入れない（指示された情報のみ）
    'Do NOT invent or display any URL, web address, email, phone number, or social handle. Show contact info ONLY if it is explicitly provided in the text above; otherwise omit it entirely (never use placeholder/example links such as www.example.com).',
    'High quality, professional, trustworthy. No watermark. No UI chrome. No borders around the slide.',
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
