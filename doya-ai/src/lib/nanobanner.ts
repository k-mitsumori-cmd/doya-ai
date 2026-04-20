// ========================================
// 画像生成（Nano Banana Pro ONLY）
// ========================================
// 
// 参考: https://ai.google.dev/gemini-api/docs/gemini-3?hl=ja
// 
// 【必要な環境変数】
// GOOGLE_GENAI_API_KEY: Google AI Studio で取得したAPIキー
//
// 【APIキー取得手順】
// 1. Google AI Studio (https://aistudio.google.com/) にアクセス
// 2. 「Get API key」をクリック
// 3. 「Create API key」でキーを作成
// 4. 生成されたAPIキーをコピー
//
// 【使用モデル（画像生成）】
// - Nano Banana Pro（画像生成 🍌）
//   ※ Gemini 2.5 以下 / Imagen は使用しない（要望）
//
// ========================================

import sharp from 'sharp'

// Google AI Studio API 設定
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'


type GeminiModel = {
  name?: string
  supportedGenerationMethods?: string[]
} & Record<string, any>

async function fetchAsBase64(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`fileUri fetch failed: ${res.status}`)
  const ab = await res.arrayBuffer()
  return Buffer.from(ab).toString('base64')
}

function normalizeModelId(model: string): string {
  const m = String(model || '').trim()
  if (!m) return ''
  return m.startsWith('models/') ? m.slice('models/'.length) : m
}

let modelsCache: { at: number; models: GeminiModel[] } | null = null
const MODELS_CACHE_TTL_MS = 10 * 60 * 1000 // 10分

async function listModels(apiKey: string): Promise<GeminiModel[]> {
  const now = Date.now()
  if (modelsCache && now - modelsCache.at < MODELS_CACHE_TTL_MS) return modelsCache.models

  const res = await fetch(`${GEMINI_API_BASE}/models`, {
    method: 'GET',
    headers: {
      'x-goog-api-key': apiKey,
    },
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`ListModels failed: ${res.status} - ${t.substring(0, 300)}`)
  }
  const json = await res.json()
  const models = Array.isArray(json?.models) ? (json.models as GeminiModel[]) : []
  modelsCache = { at: now, models }
  return models
}

function isGenerateContentSupported(m: GeminiModel): boolean {
  const methods = m?.supportedGenerationMethods
  return Array.isArray(methods) && methods.includes('generateContent')
}

async function resolveNanoBananaImageModel(apiKey: string, configured: string): Promise<string> {
  const cfg = normalizeModelId(configured)
  const lower = cfg.toLowerCase()

  // エイリアス（ユーザーの設定値）: nano-banana-pro / nanobanana-pro 等
  const isAlias =
    lower === 'nano-banana-pro' ||
    lower === 'nanobanana-pro' ||
    lower === 'nano_banana_pro' ||
    lower === 'nano-banana'

  // まずエイリアスは必ず実モデルIDへ解決する（"banana" を含むので素通りしない）
  if (!isAlias) {
    // 明示的に指定されていて "banana" を含むならそのまま（存在可否はAPIが検証）
    if (lower.includes('banana') && cfg) return cfg
    return cfg
  }

  // ListModels から「Nano Bananaっぽい」+ generateContent 対応モデルを探す
  const models = await listModels(apiKey)
  const names = models
    .map((m) => String(m?.name || ''))
    .filter(Boolean)

  const candidates = models
    .filter((m) => isGenerateContentSupported(m))
    .map((m) => String(m?.name || ''))
    .filter(Boolean)
    .map((full) => normalizeModelId(full))

  const banana = candidates.find((n) => n.toLowerCase().includes('banana'))
  if (banana) return banana

  // 次点: image generation に関連しそうな名称
  const imagey =
    candidates.find((n) => n.toLowerCase().includes('image')) ||
    candidates.find((n) => n.toLowerCase().includes('nano')) ||
    ''
  if (imagey) return imagey

  throw new Error(
    `Nano Banana Pro のモデルIDを自動解決できませんでした。` +
      `ListModels上の候補が見つかりません。` +
      `（models=${names.slice(0, 20).join(', ')}${names.length > 20 ? ', ...' : ''}）`
  )
}

function pickFirstText(parts: any[] | undefined): string {
  if (!Array.isArray(parts)) return ''
  const t = parts
    .map((p: any) => (typeof p?.text === 'string' ? p.text : ''))
    .join('\n')
    .trim()
  return t
}

async function extractImageBase64FromGeminiResult(result: any): Promise<{ base64: string; mimeType?: string } | null> {
  const parts = result?.candidates?.[0]?.content?.parts
  if (!Array.isArray(parts)) return null

  for (const part of parts) {
    // inlineData (most common)
    const inline = (part as any)?.inlineData || (part as any)?.inline_data
    if (inline?.data && typeof inline.data === 'string') {
      return { base64: inline.data, mimeType: inline?.mimeType }
    }

    // fileData / file_data (some responses may return a URI)
    const file = (part as any)?.fileData || (part as any)?.file_data
    const fileUri = file?.fileUri || file?.file_uri
    if (typeof fileUri === 'string' && fileUri.startsWith('http')) {
      const b64 = await fetchAsBase64(fileUri)
      return { base64: b64, mimeType: file?.mimeType }
    }
  }

  return null
}

/**
 * 画像生成モデルを Nano Banana Pro のみに固定（要望）
 *
 * - Nano Banana Pro 以外（Gemini 2.5以下 / Imagen 等）は使用しない
 * - もし設定が不正なら「問い合わせ/設定ミス」エラーを返す
 *
 * 参照: https://ai.google.dev/gemini-api/docs/gemini-3?hl=ja
 */
const IMAGE_MODEL_DEFAULT = 'nano-banana-pro'

function assertNanoBananaOnly(model: string): void {
  const m = String(model || '').trim()
  if (!m) {
    throw new Error(
      '画像生成モデルが未設定です。Vercel環境変数 `DOYA_BANNER_IMAGE_MODEL`（または `NANO_BANANA_PRO_MODEL`）に Nano Banana Pro のモデルIDを設定してください。'
    )
  }

  const lower = m.toLowerCase()

  // Nano Banana Pro の実モデルID（環境によりこちらが提示されることがある）
  // 例: /api/banner/models の suggestedImageModels に出てくる
  // - models/gemini-3-pro-image-preview
  const isGemini3ProImagePreview = lower === 'gemini-3-pro-image-preview' || lower === 'models/gemini-3-pro-image-preview'

  // ユーザー要望: Gemini 2.5 以下は使用しない
  if (lower.includes('gemini-2') || lower.includes('gemini-1') || lower.includes('gemini-2.5')) {
    throw new Error(`Gemini 2.5以下（${m}）は使用できません。Nano Banana Pro のモデルIDを設定してください。`)
  }
  // ユーザー要望: Imagen は使用しない
  if (lower.includes('imagen')) {
    throw new Error(`Imagen（${m}）は使用できません。Nano Banana Pro のモデルIDを設定してください。`)
  }

  // Nano Banana Pro のみ許可（ゆらぎに強くするため "banana" を必須にする）
  // ただしユーザーが "nano-banana-pro" を設定している場合はエイリアスとして許可し、実モデルIDへ自動解決する
  const isAlias =
    lower === 'nano-banana-pro' ||
    lower === 'nanobanana-pro' ||
    lower === 'nano_banana_pro' ||
    lower === 'nano-banana'

  if (!lower.includes('banana') && !isAlias && !isGemini3ProImagePreview) {
    throw new Error(
      `画像生成モデル（${m}）は Nano Banana Pro ではありません。Nano Banana Pro のモデルIDを設定してください。`
    )
  }
}

function getImageModel(): string {
  const model =
    process.env.DOYA_BANNER_IMAGE_MODEL ||
    process.env.NANO_BANANA_PRO_MODEL ||
    process.env.GEMINI_IMAGE_MODEL ||
    IMAGE_MODEL_DEFAULT

  assertNanoBananaOnly(model)
  return model
}

function getGeminiTextModel(): string {
  return (
    process.env.DOYA_BANNER_TEXT_MODEL ||
    process.env.GEMINI_PRO3_MODEL ||
    process.env.GEMINI_PRO_3_MODEL ||
    process.env.GEMINI_TEXT_MODEL ||
    // 未設定時は Gemini 3 Flash（無料枠あり）を使用
    // 参照: https://ai.google.dev/gemini-api/docs/gemini-3?hl=ja
    'gemini-3-flash-preview'
  )
}

// テキスト生成のフォールバックモデル（Gemini 3系を使用）
const DEFAULT_TEXT_FALLBACKS = ['gemini-3-pro-preview', 'gemini-3-flash-preview'] as const

// APIキーを取得（複数の環境変数に対応）
function getApiKey(): string {
  const apiKey = 
    process.env.GOOGLE_GENAI_API_KEY || 
    process.env.GOOGLE_AI_API_KEY || 
    process.env.GEMINI_API_KEY ||
    process.env.NANOBANNER_API_KEY
    
  if (!apiKey) {
    throw new Error('GOOGLE_GENAI_API_KEY が設定されていません')
  }
  return apiKey
}

// 業種カテゴリ別のデザインガイドライン
const CATEGORY_STYLES: Record<string, { style: string; colors: string; elements: string }> = {
  telecom: {
    style: 'modern technology, Doya Banner blue theme, professional',
    colors: 'primary blue (#2563EB), light blue highlights (#DBEAFE), white, dark navy (#0F172A)',
    elements: 'smartphone, signal waves, cloud icons, speed arrows',
  },
  marketing: {
    style: 'sophisticated business, Doya Banner analytics style',
    colors: 'primary blue (#2563EB), orange accent (#F97316), yellow accent (#FBBF24), white',
    elements: 'rising graphs, growth arrows, chart icons, data visualization',
  },
  ec: {
    style: 'vibrant sale, urgency, Doya Banner shopping theme',
    colors: 'orange (#F97316), amber (#FBBF24), Doya Banner blue (#2563EB), white',
    elements: 'shopping cart, gift boxes, sale tags, percent signs, ribbons',
  },
  recruit: {
    style: 'bright hopeful, Doya Banner career portal style',
    colors: 'primary blue (#2563EB), green accent (#22C55E), white, gray-50',
    elements: 'office buildings, handshake, teamwork silhouettes, career ladder',
  },
  beauty: {
    style: 'elegant refined, feminine premium, Doya Banner soft theme',
    colors: 'pink (#EC4899), Doya Banner blue (#2563EB), amber accent (#FBBF24), white',
    elements: 'flowers, cosmetic bottles, sparkles, ribbons, elegant patterns',
  },
  food: {
    style: 'delicious appetizing, Doya Banner warm inviting style',
    colors: 'red (#EF4444), orange (#F97316), amber (#FBBF24), white',
    elements: 'food imagery, steam effects, fresh ingredients, restaurant ambiance',
  },
  realestate: {
    style: 'trustworthy stable, Doya Banner property portal style',
    colors: 'teal (#14B8A6), Doya Banner blue (#2563EB), amber accent (#FBBF24), white',
    elements: 'buildings, houses, keys, location pins, modern architecture',
  },
  education: {
    style: 'inspiring learning, Doya Banner academic style',
    colors: 'indigo (#6366F1), Doya Banner blue (#2563EB), yellow accent (#FBBF24), white',
    elements: 'books, graduation caps, light bulbs, academic icons',
  },
  finance: {
    style: 'trustworthy secure, Doya Banner financial portal style',
    colors: 'navy blue (#0F172A), amber (#FBBF24), Doya Banner blue (#2563EB), white',
    elements: 'coins, graphs, secure locks, growth charts, financial icons',
  },
  health: {
    style: 'caring professional, Doya Banner medical style',
    colors: 'cyan (#06B6D4), Doya Banner blue (#2563EB), white, slate-50',
    elements: 'medical crosses, hearts, caring hands, health icons',
  },
  it: {
    style: 'innovative tech, Doya Banner digital style',
    colors: 'Doya Banner blue (#2563EB), dark navy (#0F172A), amber accent (#FBBF24), white',
    elements: 'code snippets, circuits, cloud, AI icons, digital patterns',
  },
  other: {
    style: 'professional clean, Doya Banner versatile style',
    colors: 'Doya Banner blue (#2563EB), slate-50, orange accent (#F97316), amber (#FBBF24)',
    elements: 'abstract geometric shapes, professional icons',
  },
}

// 用途別のデザインガイドライン
const PURPOSE_STYLES: Record<string, { layout: string; emphasis: string; cta: string }> = {
  sns_ad: {
    layout: 'high-conversion SNS advertisement, eye-catching social media ad, thumb-stopping design, mobile-first optimization',
    emphasis: 'bold headline area with high contrast, vibrant visual hook, emotional connection',
    cta: 'prominent, clickable-looking CTA button like "詳しくはこちら" or "今すぐチェック"',
  },
  youtube: {
    layout: 'YouTube thumbnail, 16:9 aspect ratio, maximum visual impact, designed to compete in search results and recommendations',
    emphasis: 'massive focal point, huge text placeholder area (40%+), expressive faces, high saturation, dramatic lighting',
    cta: 'NO CTA button - focus on curiosity gap and high-impact visuals',
  },
  display: {
    layout: 'web display banner, clean layout respecting ad dimensions',
    emphasis: 'brand visibility, clear message hierarchy',
    cta: 'clickable CTA button, clear call to action',
  },
  webinar: {
    layout: 'webinar/seminar announcement, professional event style',
    emphasis: 'date/time prominent, speaker credibility, topic clarity',
    cta: '"無料登録" or "今すぐ申込" button',
  },
  lp_hero: {
    layout: 'landing page hero section, full-width impactful',
    emphasis: 'main value proposition large, supporting visuals',
    cta: 'primary action button below headline',
  },
  email: {
    layout: 'email header banner, horizontal format, quick loading',
    emphasis: 'brand recognition, clear single message',
    cta: 'subtle CTA or none (content in email body)',
  },
  article_banner: {
    layout: 'editorial article banner (NOT an advertisement), 16:9, clean and premium, content-aligned',
    emphasis:
      'make the headline/subhead extremely readable on mobile: large font, strong contrast, solid/gradient panel behind text, minimal clutter',
    cta: 'NO CTA button, NO promotional language',
  },
  campaign: {
    layout: 'promotional campaign banner, festive/urgent feel',
    emphasis: 'discount/offer prominent, limited time messaging',
    cta: '"今すぐ購入" or "お見逃しなく" urgent CTA',
  },
  event: {
    layout: 'event announcement, exciting dynamic feel',
    emphasis: 'event name, date, venue prominent',
    cta: '"参加登録" or "チケット購入" button',
  },
  product: {
    layout: 'product showcase, clean product-focused design',
    emphasis: 'product benefits, quality imagery feel',
    cta: '"商品を見る" or "詳細はこちら" button',
  },
}

// A/B/Cパターンの訴求タイプ
const APPEAL_TYPES = [
  { 
    type: 'A', 
    focus: 'Benefits focused', 
    style: [
      'Visual strategy: benefit clarity (fast comprehension) WITH readable Japanese text.',
      '- Show the core benefit visually (product-in-use, clear outcome scene, before/after).',
      '- Bright, optimistic lighting; clean background; one strong focal subject.',
      '- Use supportive visual cues (icons/shapes/arrows) to guide the eye to the CTA button.',
    ].join('\n'),
    japanese: 'ベネフィット重視',
  },
  { 
    type: 'B', 
    focus: 'Urgency and scarcity', 
    style: [
      'Visual strategy: urgency & scarcity (act-now energy) WITH readable Japanese text.',
      '- Dynamic composition (diagonal lines, motion blur accents, energetic shapes).',
      '- Use urgency colors (red/yellow) as accents only; keep a strong contrast text panel behind letters.',
      '- Add “limited/now” vibes via visual symbols: timers, streaks, burst shapes (avoid tiny numbers).',
      '- Make the CTA button look extremely clickable through contrast and subtle glow.',
    ].join('\n'),
    japanese: '緊急性・限定性',
  },
  { 
    type: 'C', 
    focus: 'Trust and credibility', 
    style: [
      'Visual strategy: trust & credibility (premium, safe) WITH readable Japanese text.',
      '- Calm, professional palette; controlled highlights; minimal clutter.',
      '- Use credibility cues as simple shapes: award badge silhouette, star shapes, certification-like seals (no tiny legal text).',
      '- Product/service shown cleanly with realistic materials; high-end finish and depth.',
      '- Strong grid alignment, generous whitespace, polished “enterprise” feel.',
    ].join('\n'),
    japanese: '信頼性・実績',
  },
]

// YouTube専用のA/B/Cパターン
const YOUTUBE_APPEAL_TYPES = [
  { 
    type: 'A', 
    focus: 'Curiosity & Shock', 
    style: 'Create extreme curiosity with shocking revelation, use words like "衝撃" "まさか" "信じられない", dramatic facial expression area, red/yellow highlight on key words, split background (before/after style)',
    japanese: '衝撃・驚き',
  },
  { 
    type: 'B', 
    focus: 'Educational & Value', 
    style: 'Promise valuable knowledge with "〜の方法" "〜のコツ" "完全解説", clean numbered list feel (3つ, 5選, 10個), professional but approachable, blue/green trustworthy colors, include visual icons or symbols',
    japanese: '教育・価値提供',
  },
  { 
    type: 'C', 
    focus: 'Emotional & Story', 
    style: 'Tell a story hook with "〜した結果" "〜してみた" "密着", personal/relatable feel, warm colors, include space for expressive human face, journey/transformation imagery hints',
    japanese: '体験・ストーリー',
  },
]

// 生成オプションの型定義
export interface GenerateOptions {
  purpose?: string
  companyName?: string
  imageDescription?: string  // ユーザーが入力したイメージ説明（例: "青空の下でジャンプする女性"）
  // 画像内に描画するテキスト（アプリ側のテキストレイヤーで合成しない）
  headlineText?: string
  subheadText?: string
  ctaText?: string
  hasLogo?: boolean
  hasPerson?: boolean
  logoDescription?: string  // ロゴの説明（例: "青い円形のロゴ"）
  personDescription?: string  // 人物の説明（例: "30代女性ビジネスパーソン"）
  logoImage?: string  // ロゴ画像のBase64データ（data:image/...;base64,...形式）
  // 人物画像（複数枚対応）
  // - 推奨: personImages を使用（最大数はAPI側で制限）
  // - 後方互換: personImage も受け付ける
  personImages?: string[]
  personImage?: string  // 互換用（単体）
  referenceImages?: string[] // 参考画像（data:image/...;base64,...形式）
  // ユーザー指定の配色（#RRGGBB 推奨）
  brandColors?: string[]
  /**
   * URL解析などで「画像生成AIに渡す最終プロンプト」を既に組み立てている場合に使用。
   * これが指定された場合、内部テンプレート（createBannerPrompt）は使わず、このプロンプトを優先する。
   */
  customImagePrompt?: string
  /**
   * 追加のネガティブプロンプト（任意）
   */
  negativePrompt?: string
  /**
   * バリエーションの出し方
   * - diverse: レイアウト/構図まで大胆に変えて多様性を最大化
   * - similar: 参照画像（referenceImages）に寄せて“似た形”のバリエーションを作る
   */
  variationMode?: 'diverse' | 'similar'
}

function parseDataUrl(dataUrl: string): { mimeType: string; data: string } {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!m) throw new Error('画像形式が不正です（data URLを期待）')
  return { mimeType: m[1], data: m[2] }
}

function buildAgencyMasterPromptJP(params: {
  catchCopy: string
  subCopy?: string
  cta?: string
  purpose?: string
  industry?: string
  mainColor?: string
  subColors?: string
  hasLogo?: boolean
  hasPerson?: boolean
}): string {
  const catchCopy = params.catchCopy || ''
  const subCopy = params.subCopy || ''
  const cta = params.cta || ''
  const purpose = params.purpose || ''
  const industry = params.industry || ''
  const mainColor = params.mainColor || ''
  const subColors = params.subColors || ''
  const logo = params.hasLogo ? '（別途ロゴ画像データ添付済み）' : '（ロゴなし）'
  const person = params.hasPerson ? '（別途人物画像データ添付済み）' : '（人物なし）'

  // ユーザー指定の“制作チームプロンプト”を、画像生成に必ず混ぜるためのテンプレート
  // ※ 画像データ（ロゴ/人物）は本文に貼らず、APIの画像パーツとして別途添付する
  return `
あなたは、広告代理店・デザイン制作会社・マーケターが合同で行う
「商用マーケティングバナー制作チーム」です。

以下の指示をすべて厳守し、
Web広告・LP・SNS・キャンペーンで
“そのまま使用できるプロ品質のバナー画像”を生成してください。

■ 最重要ルール（必ず厳守）
- 指定テキストは【一字一句変更せず】【省略せず】【誤字なく】画像内に正確に反映
- 指定テキストは最優先要素。日本語可読性を最優先
- 文字が潰れる/歪む/意味が変わる表現は禁止
- 同一文言の重複表示は禁止（同じテキストを2回以上並べない）
- 日本語は正しい文字で表示（文字化け・意味不明な文字・存在しない漢字は絶対禁止）
- 日本語テキストが正しく表示できない場合は、テキストなしの画像を生成すること

■ 画像内に必ず含めるテキスト
【キャッチコピー】${catchCopy}
【サブコピー（任意）】${subCopy}
【CTA文言（任意）】${cta}
※ 内容・表現・順序を一切変更しないこと

■ 用途指定（必ず考慮）
【用途】${purpose}
- 用途に応じた情報量・視認距離・文字サイズ
- スクロール中でも一瞬で伝わる構成
- CTR・CVRを下げない広告表現

■ 業種指定（必ず考慮）
【業種】${industry}

■ カラー指定（必ず反映）
【メインカラー】${mainColor}
【サブカラー（任意）】${subColors}
- 指定カラーは必ずデザイン全体に反映
- 文字と背景のコントラストを十分確保
- 安っぽい配色/チープなグラデーションは禁止

■ ロゴ画像の扱い
【ロゴ画像】${logo}
- ロゴは歪めず比率維持、色/形状は変更しない
- 目立たせすぎず自然な位置に配置

■ 人物画像の扱い
【人物画像】${person}
- 提供された人物画像を必ず使用（ある場合）
- 顔/身体を不自然に変形・生成し直さない
- ポジティブで自然に見えるよう調整

■ 禁止事項
- 指定テキストの改変・省略・誤字
- 同じ文言の繰り返し（例：「クーポン配布中 クーポン配布中」など）
- 読めない日本語フォント、意味不明な英語、不要記号
- ロゴや人物の破綻、透かし、無関係なブランド要素
- 文字化け・存在しない漢字・意味不明な文字列
- 日本語として読めない文字の生成（例：「夏月」→正しくは「7月」など）

■ ゴール
「修正したくならない」「そのまま広告配信できる」プロ品質のマーケティングバナー画像を生成してください。
`.trim()
}

// YouTubeサムネイル専用プロンプト生成
function createYouTubeThumbnailPrompt(
  keyword: string,
  size: string,
  appealType: typeof YOUTUBE_APPEAL_TYPES[0],
  options: GenerateOptions = {}
): string {
  const [width, height] = size.split('x')
  const wNum = Number(width)
  const hNum = Number(height)
  const isTightFormat =
    Number.isFinite(wNum) && Number.isFinite(hNum) && wNum > 0 && hNum > 0 && (hNum <= 120 || wNum / hNum >= 3.5)

  // キャッチコピー（keyword）を必ず画像内に含める
  const headline = (keyword || '').trim() || (options.headlineText || '').trim()
  const subhead = (options.subheadText || '').trim()
  const cta = (options.ctaText || '').trim()
  const company = (options.companyName || '').trim()
  const brandColors = Array.isArray(options.brandColors)
    ? options.brandColors.filter((c) => typeof c === 'string' && c.trim().length > 0).slice(0, 8)
    : []

  let prompt = `Create a highly clickable YouTube thumbnail image WITH readable Japanese text.

=== SYSTEM BRIEF (JP / MUST FOLLOW) ===
${buildAgencyMasterPromptJP({
  catchCopy: headline || keyword,
  subCopy: subhead || undefined,
  cta: cta || undefined,
  purpose: 'YouTube サムネイル',
  industry: options.purpose || '',
  mainColor: brandColors[0] || '未指定',
  subColors: brandColors.slice(1).join(', ') || '未指定',
  hasLogo: !!options.logoImage,
  hasPerson: !!(
    (Array.isArray(options.personImages) && options.personImages.length > 0) ||
    options.personImage ||
    options.hasPerson
  ),
})}

=== YOUTUBE THUMBNAIL SPECIFICATIONS ===
Format: 16:9 landscape thumbnail (${width}x${height} pixels)
Platform: YouTube - must compete for attention among many thumbnails
Goal: MAXIMIZE click-through rate (CTR) using bold visuals AND readable Japanese text

=== SIZE / CROPPING (CRITICAL) ===
- Output dimensions: EXACTLY ${width}x${height} px. Do NOT change aspect ratio.
- Fill the entire canvas edge-to-edge. NO letterboxing, NO empty top/bottom bars, NO padding.
- Keep all text fully inside the frame (no clipping). Use safe margins but do not create empty bands.

=== THUMBNAIL CONCEPT/THEME ===
"${keyword}"
${options.imageDescription ? `
=== 🎨 USER-SPECIFIED VISUAL IMAGE (IMPORTANT) ===
The user has specifically requested the following visual elements:
"${options.imageDescription}"
Incorporate these visual elements prominently in the thumbnail design.
This is a high priority request from the user.
` : ''}
=== STYLE: ${appealType.focus} ===
${appealType.style}

=== TEXT TO RENDER (MUST BE EXACT) ===
Render these strings exactly as written. Do NOT translate, do NOT paraphrase, do NOT add extra words.
- Headline (必須): ${headline || '(empty)'}
${subhead ? `- Subhead (任意): ${subhead}` : ''}
${cta ? `- CTA (任意): ${cta}` : ''}
${company ? `- Brand (任意): ${company}` : ''}

=== JAPANESE TEXT QUALITY RULES (CRITICAL) ===
- Text must be PERFECTLY LEGIBLE Japanese (no garbling, no pseudo-characters)
- Use a clean Japanese font style (Noto Sans JP-like)
- Use strong contrast + solid/gradient panel behind text
- Headline is very large, 1–2 lines max. Avoid long sentences.
- The Headline must appear as real Japanese text inside the image. Do NOT output an image without it.
- If you struggle to render Japanese correctly, OUTPUT IMAGE WITHOUT TEXT instead of garbled text.
- Do NOT include any other text besides the provided strings above.
- NO DUPLICATION: Do NOT repeat the same phrase. Each provided string (Headline/Subhead/CTA/Brand) must appear at most once in the image.
- ABSOLUTELY FORBIDDEN: Non-existent kanji, garbled characters, meaningless character combinations
- If Japanese text cannot be rendered correctly, generate a text-free image instead of broken text
- Example of WRONG text: "夏月" (should be "7月"), "お布" (should be "お知らせ"), random character combinations

=== YOUTUBE THUMBNAIL DESIGN PRINCIPLES ===
1. **HIGH CONTRAST & SATURATION**:
   - Use bright, saturated colors (no muted tones)
   - Bold color blocking
   - Consider complementary color schemes

2. **VISUAL HIERARCHY**:
   - One clear visual focal point
   - Use arrows, circles, or lines to direct attention
   - Left side for human faces
   - Keep a clean, high-contrast area for the headline text block

3. **EMOTIONAL IMPACT**:
   - Include space for expressive human face if relevant
   - Show emotion through visuals: surprise, excitement
   - Use visual metaphors (glow effects, dramatic lighting)

4. **AVOID**:
   - Tiny/low-contrast text
   - Cluttered backgrounds behind text
   - Generic stock photo feel
   - Too many competing elements
`

  // 人物画像がある場合
  if (options.hasPerson) {
    const personImages =
      Array.isArray(options.personImages) && options.personImages.length > 0
        ? options.personImages
        : (options.personImage ? [options.personImage] : [])

    if (personImages.length > 0) {
      prompt += `
=== PERSON IMAGE (PROVIDED) ===
I am providing ${personImages.length} person photo(s) to include in this thumbnail.
- Use the provided photo(s) as-is (do NOT distort faces/bodies, do NOT regenerate a new face).
- If multiple photos are provided, compose them naturally and avoid clutter.
- Position the main person on the left third of the frame and keep clear space for text.
- Leave space for the headline/subhead/CTA text on the right or bottom.
`
    } else {
      prompt += `
=== PERSON PLACEHOLDER ===
Include space for an expressive human face on the left side.
${options.personDescription ? `Person appearance: ${options.personDescription}` : 'A person with an engaging, expressive reaction'}
Leave space for the headline/subhead/CTA text on the right or bottom.
`
    }
  }

  prompt += `
${brandColors.length > 0 ? `
=== BRAND COLOR PALETTE (MUST USE) ===
Use these exact brand colors as the main palette:
${brandColors.slice(0, 8).join(', ')}
Avoid introducing new dominant colors. Minor neutrals are allowed.
` : ''}
=== FINAL OUTPUT ===
Generate a YouTube thumbnail that:
1. Is instantly eye-catching with bold visuals
2. Has the provided Japanese text rendered clearly and correctly
3. Uses a solid/gradient text panel for readability
4. Would make viewers curious to click
${isTightFormat ? `

=== SMALL/THIN FORMAT TEXT-FIT (CRITICAL) ===
- This is a small-height / extreme-wide canvas (${width}x${height}). NEVER clip text.
- Keep text inside safe margins (>= 6% from edges). Prioritize readability over decoration.
- If the string is long, reduce font size and simplify visuals. Prefer 1 line; if unavoidable, 2 short lines.
` : ''}

Create the thumbnail now.`

  return prompt
}

// バナー生成用プロンプトを作成
function createBannerPrompt(
  category: string,
  keyword: string,
  size: string,
  appealType: typeof APPEAL_TYPES[0],
  options: GenerateOptions = {}
): string {
  const categoryStyle = CATEGORY_STYLES[category] || CATEGORY_STYLES.other
  const purposeStyle = PURPOSE_STYLES[options.purpose || 'sns_ad'] || PURPOSE_STYLES.sns_ad
  const [width, height] = size.split('x')
  const wNum = Number(width)
  const hNum = Number(height)
  const isTightFormat =
    Number.isFinite(wNum) && Number.isFinite(hNum) && wNum > 0 && hNum > 0 && (hNum <= 120 || wNum / hNum >= 3.5)
  const aspectRatio = parseInt(width) > parseInt(height) ? 'landscape (horizontal)' : 
                      parseInt(width) < parseInt(height) ? 'portrait (vertical)' : 'square'
  
  const isYouTube = options.purpose === 'youtube'
  const isArticleBanner = options.purpose === 'article_banner'

  // YouTube専用プロンプト
  if (isYouTube) {
    return createYouTubeThumbnailPrompt(keyword, size, appealType, options)
  }

  // キャッチコピー（keyword）を必ず画像内に含める
  const headline = (keyword || '').trim() || (options.headlineText || '').trim()
  const subhead = (options.subheadText || '').trim()
  const cta = (options.ctaText || '').trim()
  const company = (options.companyName || '').trim()

  const brandColors = Array.isArray(options.brandColors)
    ? options.brandColors.filter((c) => typeof c === 'string' && c.trim().length > 0).slice(0, 8)
    : []
  const colorPaletteText = brandColors.length > 0
    ? `${brandColors.join(', ')} (use these as the primary palette)`
    : categoryStyle.colors

  const introText = isArticleBanner
    ? `You are a top-tier editorial banner designer for Japanese articles.
Goal: generate a premium-quality ARTICLE BANNER (NOT an advertisement) WITH readable Japanese text.`
    : `You are a world-class performance ad art director for the Japanese market.
Goal: generate a HIGH-CTR, premium-quality advertisement creative WITH readable Japanese text.`

  let prompt = `${introText}

=== SYSTEM BRIEF (JP / MUST FOLLOW) ===
${buildAgencyMasterPromptJP({
  catchCopy: headline || keyword,
  subCopy: subhead || undefined,
  cta: cta || undefined,
  purpose: String(options.purpose || 'sns_ad'),
  industry: category,
  mainColor: brandColors[0] || categoryStyle.colors,
  subColors: brandColors.slice(1).join(', ') || '未指定',
  hasLogo: !!options.logoImage,
  hasPerson: !!(
    (Array.isArray(options.personImages) && options.personImages.length > 0) ||
    options.personImage ||
    options.hasPerson
  ),
})}

=== BANNER SPECIFICATIONS ===
Format: ${aspectRatio} banner (${width}x${height} pixels)
Purpose: ${options.purpose || 'sns_ad'} - ${purposeStyle.layout}
Primary KPI: ${isArticleBanner ? 'make the article topic instantly understandable (mobile-first readability)' : 'maximize click-through rate (CTR) on mobile feeds.'}

=== SIZE / CROPPING (CRITICAL) ===
- Output dimensions: EXACTLY ${width}x${height} px. Do NOT change aspect ratio.
- Fill the entire canvas edge-to-edge. NO letterboxing, NO empty top/bottom margins, NO padding.
- Keep all text fully inside the frame (no clipping). Use safe margins but do not create empty bands.
${isTightFormat ? `
- SMALL/THIN FORMAT: This is an extreme-wide / small-height banner. NEVER clip text.
- Keep all text within a safe area (>= 6% from all edges). If space is tight, reduce font size and simplify decorative elements.
- Prefer a single, very readable headline line. If unavoidable, split into 2 short lines with smaller font.
` : ''}

=== DESIGN STYLE ===
Industry: ${categoryStyle.style}
Color palette: ${colorPaletteText}
Visual elements: ${categoryStyle.elements}

${brandColors.length > 0 ? `=== BRAND COLOR POLICY (VERY IMPORTANT) ===
Use the brand colors above for major elements (background panels, accents, shapes, CTA button shape).
Avoid introducing new dominant colors. Neutrals (white/black/gray) are allowed for readability.
` : ''}

=== LAYOUT & EMPHASIS ===
${purposeStyle.emphasis}

=== APPEAL TYPE: ${appealType.focus} ===
${appealType.style}
${options.imageDescription ? `
=== 🎨 USER-SPECIFIED VISUAL IMAGE (HIGHEST PRIORITY) ===
The user has specifically requested the following visual elements:
"${options.imageDescription}"

IMPORTANT: Incorporate these visual elements prominently in the banner design.
This overrides default imagery suggestions. Make these elements the main visual focus.
` : ''}

=== CTR CREATIVE BLUEPRINT (DO THIS) ===
${isArticleBanner
  ? `1) Content-aligned visual hook: match the article topic (no generic stock feel).
2) Readability first: ensure headline/subhead are the first thing the user reads (high contrast, large, clear).
3) Clean hierarchy: minimal clutter, large simple shapes, calm premium editorial look.
4) NO CTA: do not add any buttons or promotional elements.`
  : `1) Thumb-stopping focal point: one strong subject or outcome scene that reads in 0.5 seconds.
2) High contrast & depth: clear foreground/background separation, premium lighting, crisp details.
3) Clean hierarchy: minimal clutter, large simple shapes, strong directional lines guiding to CTA.
4) Mobile-first legibility: avoid tiny objects/patterns; ensure text is readable on mobile feeds.`}

=== TEXT TO RENDER (MUST BE EXACT) ===
Render these strings exactly as written. Do NOT translate, do NOT paraphrase, do NOT add extra words.
- Headline (必須): ${headline || '(empty)'}
${subhead ? `- Subhead (任意): ${subhead}` : ''}
${cta ? `- CTA (任意): ${cta}` : ''}
${company ? `- Brand (任意): ${company}` : ''}

=== JAPANESE TEXT QUALITY RULES (CRITICAL) ===
- Text must be PERFECTLY LEGIBLE Japanese (no garbling, no pseudo-characters)
- Use a clean Japanese font style (Noto Sans JP-like)
- Use a solid/gradient panel behind text for contrast (no busy background behind letters)
- Headline is very large, 1–2 lines max. Avoid long sentences.
- The Headline must appear as real Japanese text inside the image. Do NOT output an image without it.
- If you struggle to render Japanese correctly, retry internally; do NOT omit the text.
- Do NOT include any other text besides the provided strings above.
- NO DUPLICATION: Do NOT repeat the same phrase. Each provided string (Headline/Subhead/CTA/Brand) must appear at most once in the image.

=== DESIGN REQUIREMENTS ===
- Professional, modern, clean design
- High contrast (feed-optimized) and premium color grading
- Clear visual hierarchy
- Mobile-friendly (elements not too small)
- Avoid “generic stock photo” look; make it feel like a real high-performing Japanese paid ad
- No watermark, no signature, no logos unless provided as an image, no UI screenshots
`

  // 会社名がある場合（画像内に描画してOK）
  if (options.companyName) {
    prompt += `
=== COMPANY/BRAND NAME ===
Render the provided company/brand name exactly (Japanese/English as provided).
Keep it small and clean (e.g., bottom-left), so the headline remains dominant.
Do NOT invent any logo mark, emblem, seal, watermark, or fake brand icon.
`
  }

  // ロゴは「アップロードされた実ロゴ画像」がある場合のみ使用（勝手に適当なロゴを入れない）
  if (options.logoImage) {
    prompt += `
=== LOGO PLACEMENT (PROVIDED) ===
I am providing the company logo image. Incorporate ONLY this provided logo into the banner design.
Place the logo in a visible corner (top-left or bottom-right recommended).
Maintain the logo's original colors and shape, blending it naturally with the banner design.
`
  } else {
    prompt += `
=== LOGO / BRAND MARK POLICY (VERY IMPORTANT) ===
Do NOT include ANY logo, emblem, seal, watermark, badge, or random brand mark.
Do NOT invent a logo or "logo-like icon".
If a brand/company name is provided, you may render it small and clean as text. Do NOT invent any logo.
`
  }

  // 参考画像がある場合（ロゴ/透かしはコピーしない）
  if (options.referenceImages && options.referenceImages.length > 0) {
    prompt += `
=== REFERENCE IMAGE (STYLE/LAYOUT) ===
Use the provided reference image(s) ONLY as inspiration for:
- overall layout and composition
- color mood and typography-safe text areas
- visual style (modern, premium, clean)
Do NOT copy any logos, watermarks, brand marks, or copyrighted characters from the reference.
Do NOT recreate the exact same design 1:1. Create a new original banner in a similar style.
`
  }

  // 人物がある場合
  if (options.hasPerson) {
    const personImages =
      Array.isArray(options.personImages) && options.personImages.length > 0
        ? options.personImages
        : (options.personImage ? [options.personImage] : [])

    if (personImages.length > 0) {
      // 実際の人物画像が提供されている場合
      prompt += `
=== PERSON IMAGE (PROVIDED) ===
I am providing ${personImages.length} person photo(s). Please incorporate these provided person photo(s) into the banner design.
- Use the provided photo(s) as-is (do NOT distort faces/bodies, do NOT regenerate a new face).
- If multiple photos are provided, compose them naturally (balanced, not cluttered).
- Position person(s) to support the text hierarchy and keep text fully readable.
- Blend the person(s) naturally with the banner background and style.
`
    } else {
      // 人物画像がない場合は生成
      prompt += `
=== PERSON IMAGE (GENERATE) ===
Include a professional-looking person in the banner design
${options.personDescription ? `Person appearance: ${options.personDescription}` : 'A friendly business professional with welcoming expression'}
Position them on one side of the banner, leaving space for text on the other side
The person should match the banner's professional tone and target audience
`
    }
  }

  prompt += `
=== FINAL OUTPUT ===
Return ONE high-quality ad banner image WITH the Japanese text rendered correctly.
- The headline must include the catchphrase keyword exactly as provided.
- All provided text must be fully readable Japanese (no garbling) and fully inside the frame (no clipping).
- Output dimensions: EXACTLY ${width}x${height} px. Fill the canvas edge-to-edge (no empty top/bottom bars, no padding, no borders).
- CTA text should be placed inside a clickable-looking button.
- No watermark, no signature.`

  return prompt
}

// ========================================
// Nano Banana Pro で画像生成
// 公式ドキュメント: https://ai.google.dev/gemini-api/docs/image-generation?hl=ja
// ========================================
async function generateSingleBanner(
  prompt: string,
  size: string = '1080x1080',
  options: GenerateOptions = {}
): Promise<{ image: string; model: string }> {
  const apiKey = getApiKey()
  const configuredModel = getImageModel()
  const resolved = await resolveNanoBananaImageModel(apiKey, configuredModel)

  // Nano Banana Pro 系モデルの範囲内でフォールバック（Gemini 3のみ）
  const modelsToTry = Array.from(
    new Set([
      resolved,
      resolved === 'nano-banana-pro-preview' ? 'gemini-3-pro-image-preview' : 'nano-banana-pro-preview',
    ])
  )

  let lastErr: any = null
  for (const model of modelsToTry) {
    try {
      console.log(
        `Calling Image Generation (Nano Banana Pro) with model: ${model}...` +
          (normalizeModelId(configuredModel) !== model ? ` (resolved from ${configuredModel})` : '')
      )

  const aspectRatio = getAspectRatio(size)
  const [w, h] = size.split('x').map((v) => Number(v))

  // Nano Banana Pro 用のAPIコール（generateContent）
  const endpoint = `${GEMINI_API_BASE}/models/${model}:generateContent`

      // 参考画像/ロゴ/人物を「画像→テキスト」の順で渡す
      const imageParts: any[] = []
      const refs = (options?.referenceImages || []).slice(0, 2)
      for (const ref of refs) {
        try {
          const parsed = parseDataUrl(ref)
          imageParts.push({ inlineData: { mimeType: parsed.mimeType, data: parsed.data } })
        } catch { /* ignore */ }
      }
      if (options?.logoImage) {
        try {
          const parsed = parseDataUrl(options.logoImage)
          imageParts.push({ inlineData: { mimeType: parsed.mimeType, data: parsed.data } })
        } catch { /* ignore */ }
      }
      const personImages =
        Array.isArray(options?.personImages) && options.personImages.length > 0
          ? options.personImages
          : (options?.personImage ? [options.personImage] : [])
      for (const p of personImages.slice(0, 4)) {
        try {
          const parsed = parseDataUrl(p)
          imageParts.push({ inlineData: { mimeType: parsed.mimeType, data: parsed.data } })
        } catch { /* ignore */ }
      }

      const requestBody = {
          contents: [
            {
              role: 'user',
              parts: [
                ...imageParts,
                {
                  text: [
                    prompt,
                    '',
                    '=== MANDATORY OUTPUT CONSTRAINTS ===',
                    `**TARGET SIZE: ${w}x${h} pixels (width x height)**`,
                    `**ASPECT RATIO: ${aspectRatio}**`,
                    '',
                    'CRITICAL REQUIREMENTS:',
                    `- Generate image with ${aspectRatio} aspect ratio.`,
                    '- Fill the entire canvas edge-to-edge with content.',
                    '- NO letterboxing, NO empty bars, NO padding, NO borders.',
                    '',
                    '=== JAPANESE TEXT QUALITY (CRITICAL) ===',
                    '- Japanese text must be PERFECTLY CORRECT and READABLE.',
                    '- ABSOLUTELY FORBIDDEN: garbled text, non-existent kanji, meaningless character combinations.',
                    '- If you cannot render Japanese text correctly, DO NOT include any text in the image.',
                    '- Examples of WRONG text to avoid: "夏月" (wrong), "お布" (wrong), random kanji combinations.',
                    '- Better to have NO TEXT than WRONG TEXT.',
                    '',
                    'Return ONE PNG image.',
                  ].join('\n'),
                },
              ],
            },
          ],
          generationConfig: {
            // 画像生成は IMAGE のみを要求（テキストのみの返答を防ぐ）
            // 参照: https://ai.google.dev/gemini-api/docs/gemini-3?hl=ja#image_generation
            responseModalities: ['IMAGE'],
            temperature: 0.4,
            candidateCount: 1,
            // 注意: aspectRatioパラメータはGemini APIでサポートされていない可能性があるため、
            // プロンプト内でサイズを指示し、後処理でリサイズする方式を採用
          },
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
          ],
        }
            
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify(requestBody),
      })
            
      if (!response.ok) {
        const errorText = await response.text()
        let errorMessage = ''
        
        try {
          const errorJson = JSON.parse(errorText)
          const errorCode = errorJson?.error?.code || response.status
          const errorMsg = errorJson?.error?.message || errorText
          
          // 429エラー（使用量制限）の場合
          if (response.status === 429 || errorCode === 429) {
            errorMessage = `APIの使用量制限に達しました。しばらく時間をおいてから再試行してください。\n` +
              `詳細: ${errorMsg}\n` +
              `プランと請求情報をご確認ください: https://ai.google.dev/gemini-api`
          } else if (response.status === 401 || errorCode === 401) {
            errorMessage = `APIキーが無効です。環境変数のGOOGLE_GENAI_API_KEYをご確認ください。`
          } else if (response.status === 403 || errorCode === 403) {
            errorMessage = `APIアクセスが拒否されました。APIキーの権限とプランをご確認ください。`
          } else if (response.status === 400 || errorCode === 400) {
            errorMessage = `リクエストが無効です。プロンプトやパラメータをご確認ください。\n` +
              `詳細: ${errorMsg}`
          } else {
            errorMessage = `画像生成に失敗しました（Nano Banana Pro / ${model}）。\n` +
              `環境変数のモデルIDとAPIキーをご確認ください。\n` +
              `参照: https://ai.google.dev/gemini-api/docs/gemini-3?hl=ja#image_generation\n` +
              `ステータス: ${response.status}\n` +
              `エラー: ${errorMsg.substring(0, 200)}`
          }
        } catch (parseError) {
          // JSONパースに失敗した場合は元のエラーテキストを使用
          if (response.status === 429) {
            errorMessage = `APIの使用量制限に達しました。しばらく時間をおいてから再試行してください。\n` +
              `詳細: ${errorText.substring(0, 200)}`
          } else {
            errorMessage = `画像生成に失敗しました（Nano Banana Pro / ${model}）。\n` +
              `環境変数のモデルIDとAPIキーをご確認ください。\n` +
              `参照: https://ai.google.dev/gemini-api/docs/gemini-3?hl=ja#image_generation\n` +
              `ステータス: ${response.status}\n` +
              `エラー: ${errorText.substring(0, 200)}`
          }
        }
        
        console.warn(`Model ${model} failed:`, response.status, errorText)
        
        // 429エラーの場合は、他のモデルにフォールバックせずに即座にエラーを返す
        if (response.status === 429) {
          throw new Error(errorMessage)
        }
        
        throw new Error(errorMessage)
      }
            
      const result = await response.json()
            
      // ブロック/フィードバック（あれば原因に含める）
      const blockReason =
        result?.promptFeedback?.blockReason ||
        result?.prompt_feedback?.block_reason ||
        ''

      // レスポンスから画像を抽出（inlineData / fileData 両対応）
      const extracted = await extractImageBase64FromGeminiResult(result)
      if (extracted?.base64) {
        console.log(`Image generated successfully with ${model}`)
        const rawBase64 = String(extracted.base64)
        const [w_num, h_num] = size.split('x').map(v => Number(v))
        
        // サイズを確実に反映するための処理
        // 1. まず生成された画像のサイズを取得
        // 2. 指定サイズに合わせてリサイズ（アスペクト比を維持）
        // 3. 必要に応じてパディングを追加して正確なサイズにする
        const imageBuffer = Buffer.from(rawBase64, 'base64')
        const metadata = await sharp(imageBuffer).metadata()
        const originalWidth = metadata.width || 1024
        const originalHeight = metadata.height || 1024
        
        let resized: Buffer
        if (Number.isFinite(w_num) && Number.isFinite(h_num) && w_num > 0 && h_num > 0) {
          // 生成された画像のアスペクト比と目標アスペクト比を比較
          const originalRatio = originalWidth / originalHeight
          const targetRatio = w_num / h_num
          const ratioDiff = Math.abs(originalRatio - targetRatio) / targetRatio
          
          if (ratioDiff < 0.05) {
            // アスペクト比がほぼ同じ（5%以内）の場合：
            // 単純にリサイズ（fillで正確なサイズに）
            // Gemini APIが正しいアスペクト比で生成した場合はこちら
            resized = await sharp(imageBuffer)
              .resize({ 
                width: w_num, 
                height: h_num, 
                fit: 'fill' // 正確なサイズにリサイズ
              })
              .png()
              .toBuffer()
          } else {
            // アスペクト比が異なる場合：
            // 'contain' を使用してクロップを避け、背景色でパディング
            // 背景色を画像の dominant color から取得
            let bgColor = { r: 0, g: 0, b: 0, alpha: 1 }
            
            try {
              const { dominant } = await sharp(imageBuffer).stats()
              if (dominant) {
                bgColor = { r: dominant.r, g: dominant.g, b: dominant.b, alpha: 1 }
              }
            } catch {
              // 色取得に失敗した場合は黒を使用
            }
            
            resized = await sharp(imageBuffer)
              .resize({ 
                width: w_num, 
                height: h_num, 
                fit: 'contain', // クロップせず、アスペクト比を維持
                background: bgColor 
              })
              .png()
              .toBuffer()
          }
        } else {
          resized = await sharp(imageBuffer).png().toBuffer()
        }

        // Nano Banana Proが画像内にテキストを描画するため、
        // 後処理でのテキストオーバーレイは行わない（AIに任せる）

        return { image: `data:image/png;base64,${resized.toString('base64')}`, model }
      }

      const parts = result?.candidates?.[0]?.content?.parts
      const text = pickFirstText(parts)
      const hint = [
        blockReason ? `blockReason=${blockReason}` : '',
        text ? `text="${text.slice(0, 180)}"` : '',
      ]
        .filter(Boolean)
        .join(' / ')

      throw new Error(`Model ${model} returned no image data${hint ? ` (${hint})` : ''}`)
    } catch (e: any) {
      lastErr = e
      continue
    }
  }

  throw lastErr || new Error('Model returned no image data')
}

// 使用モデルの表示名を取得
export function getModelDisplayName(model: string): string {
  if (!model) return '不明'
  const lower = model.toLowerCase()
  if (lower.includes('banana')) return 'Nano Banana Pro'
  if (lower === 'gemini-3-pro-image-preview') return 'Nano Banana Pro'
  return model
}

// Gemini（テキストモデル）で「画像生成用プロンプト」を短く最適化（失敗したら元プロンプトを使う）
async function refinePromptWithGemini3Flash(originalPrompt: string): Promise<string> {
  const apiKey = getApiKey()
  const primary = getGeminiTextModel()
  const models = Array.from(new Set([primary, ...DEFAULT_TEXT_FALLBACKS]))

  const instruction = [
    'You are a prompt engineer for a premium image generation model.',
    'Rewrite the following prompt into a concise, high-signal image prompt (English).',
    'Keep ALL constraints about exact pixel size, edge-to-edge (no letterboxing), and Japanese text readability.',
    'Keep ALL user-provided details (visual description, brand colors, provided logo/person instructions, and exact strings to render).',
    'Do not add policy text. Output ONLY the final prompt.',
    '',
    '--- ORIGINAL PROMPT ---',
    originalPrompt,
  ].join('\n')

  const requestBody = {
    contents: [{ parts: [{ text: instruction }] }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 900,
    },
  }

  let lastErr: any = null
  for (const model of models) {
    try {
      const endpoint = `${GEMINI_API_BASE}/models/${model}:generateContent`
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify(requestBody),
      })

      if (!res.ok) {
        const t = await res.text()
        throw new Error(`Gemini prompt error: ${res.status} - ${t.substring(0, 300)}`)
      }

      const json = await res.json()
      const parts = json?.candidates?.[0]?.content?.parts
      const text = Array.isArray(parts)
        ? parts.map((p: any) => (typeof p?.text === 'string' ? p.text : '')).join('\n').trim()
        : ''
      if (!text) throw new Error('Gemini prompt returned empty')
      return text
    } catch (e: any) {
      lastErr = e
      continue
    }
  }

  throw lastErr || new Error('Gemini prompt refine failed')
}

const EXTRA_VARIANT_HINTS: string[] = [
  'Make it more minimal and premium: fewer elements, strong typography hierarchy, lots of clean space (but no empty bands).',
  'Make it more bold and punchy: heavier shapes, stronger contrast, and a more aggressive CTA emphasis.',
  'Make it more photo-centric: subject larger, background simpler, and text panel super clean.',
  'Make it more infographic-like: simple icons/shapes to support the claim (no extra text).',
  'Make it more dynamic: diagonal composition, energetic accents, but keep text perfectly readable.',
  'Make it more luxury: subtle gradients, refined palette, high-end feel (avoid cheap effects).',
  'Make it more playful: friendly shapes, upbeat tone, but keep high CTR and legibility.',
]

// バリエーションの"型"（レイアウト差分を強制して似た見た目を回避）
// ※ 順序をシャッフルして多様なレイアウトが生成されるようにしている
const DIVERSE_CREATIVE_PRESETS: string[] = [
  // 1. フルブリード・センター配置（最も汎用的）
  'Layout: full-bleed hero. Large background image/scene fills the entire canvas. Headline and CTA overlay on a semi-transparent gradient panel. Text centered or bottom-aligned. Premium, immersive feel.',
  // 2. 大胆なタイポグラフィ中心
  'Layout: centered headline with large numeric/short phrase. Add a prominent badge (e.g., "無料", "限定", "No.1" style) and a clean CTA button below. Minimal background.',
  // 3. 商品クローズアップ
  'Layout: product close-up. Large product/scene photo, headline in a translucent panel, CTA as a pill button. Background slightly blurred for focus.',
  // 4. ダイナミック・斜め構図
  'Layout: diagonal / dynamic composition. Use bold shape accents and a high-contrast CTA button. Keep text on a clean panel for readability.',
  // 5. プレミアム・ミニマル
  'Layout: premium minimal. Lots of whitespace, thin lines, refined typography, subtle gradient. Small trust badge near the headline. CTA understated but clickable.',
  // 6. セール・キャンペーン
  'Layout: bold sale/campaign. Big discount/offer number emphasis, urgency accents, but with strong contrast text blocks. CTA very prominent.',
  // 7. インフォグラフィック
  'Layout: infographic. 2–3 simple icon bullets (NO extra text beyond provided copy), with a clear headline and CTA. Use grid alignment.',
  // 8. コラージュグリッド
  'Layout: collage grid. 2–3 image tiles with one dominant tile, headline across the grid, CTA in a corner. Keep it modern and uncluttered.',
  // 9. 比較・ビフォーアフター
  'Layout: comparison / before-after. Split background into two zones, with a clear "変化" feeling. Headline on top, sub on middle, CTA bottom.',
  // 10. スプリットスクリーン（左右分割）- 後ろに移動
  'Layout: split-screen. One side is a solid color text panel (big headline), the other side is the hero photo/product. CTA at bottom of the text panel. Strong hierarchy.',
  // 11. 実績・証言
  'Layout: testimonial / proof. Include a simple quote bubble shape and a "実績/導入" style proof badge. Keep it clean and realistic (no tiny legal text).',
]

// "似た形"再生成時：レイアウトは大きく変えず、要素の強弱/表現だけ変える
// ※ 順序をシャッフルして多様なバリエーションが生成されるようにしている
const SIMILAR_CREATIVE_PRESETS: string[] = [
  // 1. 背景処理の変更
  'Keep the overall composition close to the reference. Variation: change background treatment (solid → subtle gradient, or light texture) while preserving readability.',
  // 2. タイポグラフィの雰囲気変更
  'Keep the overall composition close to the reference. Variation: change typography mood (bold/gothic vs clean/sans) while keeping text fully readable.',
  // 3. 写真とテキストのバランス調整
  'Keep the overall composition close to the reference. Variation: tweak photo vs text balance (photo slightly larger/smaller) while keeping the template consistent.',
  // 4. コントラスト・カラー調整
  'Keep the overall composition close to the reference. Variation: increase/decrease contrast, adjust color palette within the brand colors, keep the same layout.',
  // 5. ヒーロー画像のアングル変更
  'Keep the overall composition close to the reference. Variation: swap the hero image angle/scene while keeping similar framing and whitespace for text.',
  // 6. アイコン・アクセント変更
  'Keep the overall composition close to the reference. Variation: change iconography accents (simple shapes) and adjust alignment slightly (left → center) but keep the same template.',
  // 7. バッジの追加/削除
  'Keep the overall composition close to the reference. Variation: add/remove a simple badge (e.g., "無料" / "最短" / "実績") without clutter.',
  // 8. 信頼性要素の強調/削除
  'Keep the overall composition close to the reference. Variation: emphasize trust cues (badge/seal silhouette) or remove them for a cleaner version (one per output).',
  // 9. CTAボタンの形状・色変更
  'Keep the overall composition close to the reference. Variation: change the CTA button shape and color accent, and adjust text hierarchy (headline bigger, sub smaller).',
  // 10. CTA配置の微調整
  'Keep the overall composition close to the reference. Variation: change the CTA placement within the same layout area (bottom-left vs bottom-right) but keep consistent spacing.',
]

function buildHardConstraintsAppendix(keyword: string, size: string, options: GenerateOptions, patternLabel: string): string {
  const [width, height] = size.split('x')
  const headline = (keyword || '').trim() || (options.headlineText || '').trim()
  const subhead = (options.subheadText || '').trim()
  const cta = (options.ctaText || '').trim()
  const company = (options.companyName || '').trim()

  // customImagePrompt を使う場合は、サイズ制約を強調して追加
  // プロンプト自体にレイアウト指示が含まれているため、共通のレイアウト指示は追加しない
  if (options?.customImagePrompt) {
    const aspectRatio = parseInt(width) > parseInt(height) ? 'landscape (horizontal)' : 
                        parseInt(width) < parseInt(height) ? 'portrait (vertical)' : 'square'
    return [
      '',
      '=== CRITICAL OUTPUT CONSTRAINTS (MUST FOLLOW) ===',
      `**EXACT OUTPUT DIMENSIONS: ${width}x${height} pixels**`,
      `**ASPECT RATIO: ${aspectRatio}**`,
      '',
      'SIZE REQUIREMENTS (MANDATORY):',
      `- The output image MUST be EXACTLY ${width} pixels wide and ${height} pixels tall.`,
      `- DO NOT change the aspect ratio under any circumstances.`,
      `- Fill the ENTIRE canvas edge-to-edge with content.`,
      `- NO letterboxing, NO empty bars at top/bottom/sides, NO padding, NO borders.`,
      `- If the content doesn\'t fit, scale and crop appropriately to fill ${width}x${height}.`,
      '',
      'CONTENT REQUIREMENTS:',
      '- Include readable Japanese text as specified in the prompt.',
      '- Use clean, legible Japanese typography.',
      '- Ensure all text is fully visible within the frame.',
      '',
      `FINAL: Return ONE PNG image at EXACTLY ${width}x${height} pixels.`,
    ]
      .filter(Boolean)
      .join('\n')
  }

  return [
    '',
    '=== HARD CONSTRAINTS (DO NOT DROP) ===',
    `PATTERN: ${patternLabel} (must be a distinct creative variation, but must follow the same content/image intent)`,
    `Output dimensions: EXACTLY ${width}x${height} px. Do NOT change aspect ratio.`,
    '- Fill the entire canvas edge-to-edge. NO letterboxing, NO empty top/bottom bars, NO padding, NO borders.',
    '',
    'TEXT MUST BE IN THE IMAGE (EXACT):',
    `- Headline (必須): ${headline || '(empty)'}`,
    subhead ? `- Subhead (任意): ${subhead}` : '',
    cta ? `- CTA (任意): ${cta}` : '',
    company ? `- Brand (任意): ${company}` : '',
    '',
    options.imageDescription
      ? [
          'USER VISUAL DESCRIPTION (HIGHEST PRIORITY):',
          `"${options.imageDescription}"`,
          'Reflect this in ALL patterns, including B/C and beyond.',
          '',
        ].join('\n')
      : '',
    Array.isArray(options.brandColors) && options.brandColors.length > 0
      ? [
          'BRAND COLORS (MUST USE):',
          options.brandColors.slice(0, 8).join(', '),
          '',
        ].join('\n')
      : '',
    options.logoImage
      ? 'LOGO PROVIDED: use ONLY the provided logo image. Do NOT invent any logo/mark.\n'
      : 'NO LOGO: do NOT invent any logo/mark.\n',
    options.personImage || options.hasPerson
      ? 'PERSON: include the provided person photo if available; otherwise generate a suitable person. Keep text readable.\n'
      : '',
    'FINAL: Return ONE PNG image with the Japanese text rendered correctly.',
  ]
    .filter(Boolean)
    .join('\n')
}

// サイズからアスペクト比を計算
function getAspectRatio(size: string): string {
  const [width, height] = size.split('x').map(Number)
  if (!width || !height) return '1:1'
  
  const ratio = width / height
  if (ratio > 1.7) return '16:9'
  if (ratio > 1.4) return '3:2'
  if (ratio > 1.1) return '4:3'
  if (ratio < 0.6) return '9:16'
  if (ratio < 0.75) return '2:3'
  if (ratio < 0.9) return '3:4'
  return '1:1'
}

// A/B/C 3パターンのバナーを生成
export async function generateBanners(
  category: string,
  keyword: string,
  size: string = '1080x1080',
  options: GenerateOptions = {},
  count: number = 3
): Promise<{ banners: string[]; error?: string; usedModel?: string }> {
  const imageModel = getImageModel()
  const textModel = getGeminiTextModel()

  // APIキーの確認
  const apiKey = 
    process.env.GOOGLE_GENAI_API_KEY || 
    process.env.GOOGLE_AI_API_KEY || 
    process.env.GEMINI_API_KEY ||
    process.env.NANOBANNER_API_KEY

  if (!apiKey) {
    console.error('GOOGLE_GENAI_API_KEY not configured')
    return { 
      banners: [], 
      error: 'APIキーが設定されていません。環境変数 GOOGLE_GENAI_API_KEY を設定してください。' 
    }
  }

  const isYouTube = options.purpose === 'youtube'
  const appealTypes = isYouTube ? YOUTUBE_APPEAL_TYPES : APPEAL_TYPES
  const letters = 'ABCDEFGHIJ'.split('')
  const targetCount = Math.max(1, Math.min(10, Number.isFinite(count) ? Math.floor(count) : 3))

  console.log(`Starting ${isYouTube ? 'YouTube thumbnail' : 'banner'} generation with Nano Banana Pro`)
  console.log(`Category: ${category}, Purpose: ${options.purpose}, Size: ${size}`)
  console.log(`Model(Image/NanoBanana): ${imageModel}`)
  console.log(`Model(Text/Gemini): ${textModel}`)

  try {
    const banners: string[] = Array(targetCount).fill('')
    const errors: string[] = []
    let usedModel: string | undefined = undefined
    const variationMode = options?.variationMode || 'diverse'
    const creativePresets = variationMode === 'similar' ? SIMILAR_CREATIVE_PRESETS : DIVERSE_CREATIVE_PRESETS

    // 10枚は逐次だとVercelの実行上限/フロントAbortに当たりやすいので、
    // 同時実行数を制限した並列生成にする（Nano Banana Pro / Gemini3系は維持）
    const concurrency = targetCount >= 6 ? 3 : targetCount >= 4 ? 2 : 1
    let cursor = 0

    const runOne = async (i: number) => {
      const appealType = appealTypes[i % appealTypes.length]
      const patternLabel = letters[i] || String(i + 1)
      const basePrompt = options?.customImagePrompt
        ? String(options.customImagePrompt)
        : createBannerPrompt(category, keyword, size, appealType, options)
      const diverseExtraHint =
        variationMode === 'diverse' && i >= appealTypes.length ? EXTRA_VARIANT_HINTS[i - appealTypes.length] : ''
      const creativeBrief = creativePresets[i % creativePresets.length] || ''
      console.log(`Generating ${isYouTube ? 'thumbnail' : 'banner'} pattern ${patternLabel} (${appealType.type}/${appealType.japanese})...`)

      let finalPrompt = basePrompt
      const hasStrictInputs =
        !!options.imageDescription ||
        !!options.logoImage ||
        !!options.personImage ||
        (Array.isArray(options.personImages) && options.personImages.length > 0) ||
        (Array.isArray(options.referenceImages) && options.referenceImages.length > 0) ||
        (Array.isArray(options.brandColors) && options.brandColors.length > 0)
      const hasCustomPrompt = !!options?.customImagePrompt

      // 重要入力がある場合はプロンプト圧縮で情報が落ちるリスクがあるため、基本はスキップ
      // custom prompt は圧縮/再構成で壊れやすいので必ずスキップ
      if (!hasStrictInputs && !hasCustomPrompt) {
        try {
          finalPrompt = await refinePromptWithGemini3Flash(basePrompt)
        } catch (e: any) {
          console.warn('Gemini prompt refine failed. Using base prompt.', e?.message || e)
        }
      }

      // customImagePrompt が指定されている場合は、creativeBrief と diverseExtraHint を追加しない
      // これにより、各プロンプトの fullPrompt がそのまま使用され、
      // 共通のレイアウト指示（CTA at bottom 等）が適用されない
      finalPrompt = [
        finalPrompt,
        options?.negativePrompt ? `\n=== NEGATIVE PROMPT (AVOID) ===\n${options.negativePrompt}\n` : '',
        // customImagePrompt がない場合のみ creativeBrief を追加
        (!hasCustomPrompt && creativeBrief) ? `\n=== CREATIVE BRIEF (MUST DIFFER PER PATTERN) ===\n${creativeBrief}\n` : '',
        // customImagePrompt がない場合のみ diverseExtraHint を追加
        (!hasCustomPrompt && diverseExtraHint) ? `\n=== VARIATION HINT ===\n${diverseExtraHint}\n` : '',
        buildHardConstraintsAppendix(keyword, size, options, `PATTERN ${patternLabel}`),
      ]
        .filter(Boolean)
        .join('\n')

      const result = await generateSingleBanner(finalPrompt, size, options)
      banners[i] = result.image
      if (!usedModel) usedModel = result.model
      console.log(`${isYouTube ? 'Thumbnail' : 'Banner'} ${patternLabel} generated successfully with model: ${result.model}`)
    }

    const worker = async () => {
      while (true) {
        const i = cursor++
        if (i >= targetCount) return
        const patternLabel = letters[i] || String(i + 1)
        try {
          await runOne(i)
        } catch (error: any) {
          console.error(`${isYouTube ? 'Thumbnail' : 'Banner'} ${patternLabel} generation failed:`, error.message)
          errors.push(`${patternLabel}: ${error.message}`)
          const [w, h] = size.split('x')
          banners[i] = `https://placehold.co/${w}x${h}/EF4444/FFFFFF?text=Error:+Pattern+${patternLabel}`
        } finally {
          // 同時多発を避ける軽い間引き
          await new Promise((r) => setTimeout(r, 500))
        }
      }
    }

    await Promise.all(Array.from({ length: concurrency }, () => worker()))

    console.log(`Generation complete. Used model: ${usedModel || 'unknown'}`)

    // 全て失敗した場合
    if (banners.every(b => b.startsWith('https://placehold'))) {
      // 429エラー（使用量制限）のチェック
      const isQuotaError = errors.some((e: string) => 
        e.includes('使用量制限') || 
        e.includes('quota') || 
        e.includes('429') ||
        e.toLowerCase().includes('exceeded your current quota')
      )
      
      if (isQuotaError) {
        return {
          banners,
          error: `⚠️ APIの使用量制限に達しました。\n\n【原因】\nGoogle AI Studio のAPI使用量制限に達しています。\n\n【対処法】\n・しばらく時間をおいてから再試行してください（通常、1時間ごとにリセットされます）\n・Google AI Studio でプランと請求情報をご確認ください\n・プランのアップグレードを検討してください\n\n詳細: https://ai.google.dev/gemini-api`,
          usedModel: undefined,
        }
      }
      
      return {
        banners,
        error: `⚠️ Nano Banana Pro で${isYouTube ? 'サムネイル' : 'バナー'}生成に失敗しました。\n\n【原因】\n${errors.join('\n')}\n\n【対処法】\n・GOOGLE_GENAI_API_KEY が正しいか確認\n・APIキーが有効になっているか確認\n・Google AI Studio でAPIキーを再発行してみてください`,
        usedModel: undefined,
      }
    }

    // 一部失敗した場合
    const failedCount = banners.filter(b => b.startsWith('https://placehold')).length
    if (failedCount > 0) {
      // 429エラー（使用量制限）のチェック
      const isQuotaError = errors.some((e: string) => 
        e.includes('使用量制限') || 
        e.includes('quota') || 
        e.includes('429') ||
        e.toLowerCase().includes('exceeded your current quota')
      )
      
      if (isQuotaError) {
        return { 
          banners,
          error: `⚠️ 一部のパターンでAPIの使用量制限に達しました。\n\n赤いプレースホルダーが表示されているパターンは、しばらく時間をおいてから再試行してください。\n\n詳細: https://ai.google.dev/gemini-api`,
          usedModel,
        }
      }
      
      return { 
        banners,
        error: `⚠️ ${failedCount}件のパターンで生成に失敗しました。赤いプレースホルダーが表示されているパターンは再試行してください。`,
        usedModel,
      }
    }

    return { banners, usedModel }
  } catch (error: any) {
    console.error('generateBanners error:', error)
    return { 
      banners: [], 
      error: error.message || `${isYouTube ? 'サムネイル' : 'バナー'}生成中にエラーが発生しました` 
    }
  }
}

// 環境変数のチェック
export function isNanobannerConfigured(): boolean {
  return !!(
    process.env.GOOGLE_GENAI_API_KEY || 
    process.env.GOOGLE_AI_API_KEY || 
    process.env.GEMINI_API_KEY ||
    process.env.NANOBANNER_API_KEY
  )
}
