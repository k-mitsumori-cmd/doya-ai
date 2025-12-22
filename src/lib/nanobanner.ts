// ========================================
// 画像生成（固定モデル: gemini-3-pro-image-preview）
// ========================================
// 
// 参考: https://ai.google.dev/gemini-api/docs/image-generation?hl=ja
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
// 【使用モデル】
// - gemini-3-pro-image-preview（画像生成）
//
// ========================================

import sharp from 'sharp'

// Google AI Studio API 設定
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'

/**
 * 画像生成モデルを設定する
 * - デフォルト: gemini-3-pro-image-preview（Gemini 3 Pro Image、最新の画像生成モデル）
 * - Gemini 3系のみ使用（Gemini 2.5以下は使用しない）
 *
 * 参考: https://ai.google.dev/gemini-api/docs/gemini-3?hl=ja
 * 
 * 利用可能な画像生成モデル:
 * - gemini-3-pro-image-preview (Gemini 3 Pro Image, 推奨)
 * - gemini-3-flash-preview (Gemini 3 Flash)
 */
const IMAGE_MODEL_DEFAULT = 'gemini-3-pro-image-preview'

function assertImageModel(model: string): void {
  const m = String(model || '').trim()
  const lower = m.toLowerCase()
  
  // Gemini 2.5以下は使用しない
  if (lower.includes('gemini-2') || lower.includes('gemini-1')) {
    console.warn(`Gemini 2.5以下 (${m}) は使用しません。Gemini 3 Pro Image を使用します。`)
  }
}

function getImageModel(): string {
  const model =
    process.env.DOYA_BANNER_IMAGE_MODEL ||
    process.env.NANO_BANANA_PRO_MODEL ||
    process.env.GEMINI_IMAGE_MODEL ||
    IMAGE_MODEL_DEFAULT
  
  assertImageModel(model)
  
  const lower = model.toLowerCase()
  // Gemini 2.5以下は使用しないのでデフォルト（Gemini 3）を使用
  if (lower.includes('gemini-2') || lower.includes('gemini-1')) {
    return IMAGE_MODEL_DEFAULT
  }

  // Gemini 3系のみ使用
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

// テキスト生成のフォールバックモデル（Gemini 3系のみ）
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
      'Visual strategy: benefit clarity (fast comprehension) WITHOUT text.',
      '- Show the core benefit visually (product-in-use, clear outcome scene, before/after as imagery ONLY).',
      '- Bright, optimistic lighting; clean background; one strong focal subject.',
      '- Use supportive visual cues (icons/shapes/arrows WITHOUT text) to guide the eye to the CTA-shape.',
    ].join('\n'),
    japanese: 'ベネフィット重視',
  },
  { 
    type: 'B', 
    focus: 'Urgency and scarcity', 
    style: [
      'Visual strategy: urgency & scarcity (act-now energy) WITHOUT text.',
      '- Dynamic composition (diagonal lines, motion blur accents, energetic shapes).',
      '- Use urgency colors (red/yellow) as accents only; keep background readable for overlay.',
      '- Add “limited/now” vibes via visual symbols: timers, streaks, burst shapes (NO numbers).',
      '- Make the CTA-shape look extremely clickable through contrast and subtle glow.',
    ].join('\n'),
    japanese: '緊急性・限定性',
  },
  { 
    type: 'C', 
    focus: 'Trust and credibility', 
    style: [
      'Visual strategy: trust & credibility (premium, safe) WITHOUT text.',
      '- Calm, professional palette; controlled highlights; minimal clutter.',
      '- Use credibility cues as SHAPES: award badge silhouettes, star shapes, certification-like seals (NO text).',
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
  hasLogo?: boolean
  hasPerson?: boolean
  logoDescription?: string  // ロゴの説明（例: "青い円形のロゴ"）
  personDescription?: string  // 人物の説明（例: "30代女性ビジネスパーソン"）
  logoImage?: string  // ロゴ画像のBase64データ（data:image/...;base64,...形式）
  personImage?: string  // 人物画像のBase64データ
  referenceImages?: string[] // 参考画像（data:image/...;base64,...形式）
  // ユーザー指定の配色（#RRGGBB 推奨）
  brandColors?: string[]
}

function parseDataUrl(dataUrl: string): { mimeType: string; data: string } {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!m) throw new Error('画像形式が不正です（data URLを期待）')
  return { mimeType: m[1], data: m[2] }
}

// YouTubeサムネイル専用プロンプト生成
function createYouTubeThumbnailPrompt(
  keyword: string,
  size: string,
  appealType: typeof YOUTUBE_APPEAL_TYPES[0],
  options: GenerateOptions = {}
): string {
  const [width, height] = size.split('x')

  let prompt = `Create a highly clickable YouTube thumbnail image (NO TEXT - visual design only).

=== YOUTUBE THUMBNAIL SPECIFICATIONS ===
Format: 16:9 landscape thumbnail (${width}x${height} pixels)
Platform: YouTube - must compete for attention among many thumbnails
Goal: MAXIMIZE click-through rate (CTR) through VISUALS ONLY

=== THUMBNAIL CONCEPT/THEME ===
"${keyword}"
Express this concept through visuals, NOT through text.
${options.imageDescription ? `
=== 🎨 USER-SPECIFIED VISUAL IMAGE (IMPORTANT) ===
The user has specifically requested the following visual elements:
"${options.imageDescription}"
Incorporate these visual elements prominently in the thumbnail design.
This is a high priority request from the user.
` : ''}
=== STYLE: ${appealType.focus} ===
${appealType.style}

=== ⚠️⚠️⚠️ CRITICAL: NO TEXT RULE ⚠️⚠️⚠️ ===
**ABSOLUTELY DO NOT INCLUDE ANY TEXT**
- NO Japanese characters
- NO English text  
- NO numbers
- NO letters of any kind
- Text will be overlaid separately in post-production

Instead, create PURE VISUAL DESIGN with:
1. **LARGE TEXT PLACEHOLDER AREA** (40% of thumbnail)
   - Solid color block or gradient area
   - Position on right side or bottom
   - High contrast background for text overlay later

2. **VISUAL STORYTELLING**
   - Express the concept through imagery only
   - Use colors, shapes, and composition
   - Include visual metaphors (arrows, icons, expressions)

=== YOUTUBE THUMBNAIL DESIGN PRINCIPLES ===
1. **HIGH CONTRAST & SATURATION**:
   - Use bright, saturated colors (no muted tones)
   - Bold color blocking
   - Consider complementary color schemes

2. **VISUAL HIERARCHY**:
   - One clear visual focal point
   - Use arrows, circles, or lines to direct attention
   - Left side for human faces
   - Right side reserved for text overlay area

3. **EMOTIONAL IMPACT**:
   - Include space for expressive human face if relevant
   - Show emotion through visuals: surprise, excitement
   - Use visual metaphors (glow effects, dramatic lighting)

4. **AVOID**:
   - Any text or characters
   - Cluttered backgrounds
   - Generic stock photo feel
   - Too many competing elements
`

  // 人物画像がある場合
  if (options.hasPerson) {
    if (options.personImage) {
      prompt += `
=== PERSON IMAGE (PROVIDED) ===
I am providing a person's photo to include in this thumbnail.
Position them on the left third of the frame.
The person should have an engaging, expressive pose.
Leave the right side completely clear for text overlay.
`
    } else {
      prompt += `
=== PERSON PLACEHOLDER ===
Include space for an expressive human face on the left side.
${options.personDescription ? `Person appearance: ${options.personDescription}` : 'A person with an engaging, expressive reaction'}
The right side must remain clear for text overlay.
`
    }
  }

  prompt += `
${Array.isArray(options.brandColors) && options.brandColors.length > 0 ? `
=== BRAND COLOR PALETTE (MUST USE) ===
Use these exact brand colors as the main palette:
${options.brandColors.slice(0, 8).join(', ')}
Avoid introducing new dominant colors. Minor neutrals are allowed.
` : ''}
=== FINAL OUTPUT ===
Generate a YouTube thumbnail that:
1. Is instantly eye-catching with PURE VISUAL design
2. Has NO text, NO characters, NO letters whatsoever
3. Has a clear area reserved for text overlay (solid/gradient block)
4. Conveys the emotion and theme through visuals only
5. Would make viewers curious to click

Create the thumbnail now - REMEMBER: NO TEXT AT ALL.`

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
  const aspectRatio = parseInt(width) > parseInt(height) ? 'landscape (horizontal)' : 
                      parseInt(width) < parseInt(height) ? 'portrait (vertical)' : 'square'
  
  const isYouTube = options.purpose === 'youtube'

  // YouTube専用プロンプト
  if (isYouTube) {
    return createYouTubeThumbnailPrompt(keyword, size, appealType, options)
  }

  // NOTE:
  // テキストは「アプリ側のテキストレイヤー」で合成するため、
  // 画像モデルに文字を描かせない（英語っぽい謎文字/日本語崩れを根絶する）

  const brandColors = Array.isArray(options.brandColors)
    ? options.brandColors.filter((c) => typeof c === 'string' && c.trim().length > 0).slice(0, 8)
    : []
  const colorPaletteText = brandColors.length > 0
    ? `${brandColors.join(', ')} (use these as the primary palette)`
    : categoryStyle.colors

  let prompt = `You are a world-class performance ad art director for the Japanese market.
Goal: generate a HIGH-CTR, premium-quality advertisement creative through VISUALS ONLY (no text).

=== BANNER SPECIFICATIONS ===
Format: ${aspectRatio} banner (${width}x${height} pixels)
Purpose: ${options.purpose || 'sns_ad'} - ${purposeStyle.layout}
Primary KPI: maximize click-through rate (CTR) on mobile feeds.

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
1) Thumb-stopping focal point: one strong subject or outcome scene that reads in 0.5 seconds.
2) High contrast & depth: clear foreground/background separation, premium lighting, crisp details.
3) Clean hierarchy: minimal clutter, large simple shapes, strong directional lines guiding to CTA-shape.
4) Mobile-first legibility: avoid tiny objects/patterns; keep negative space for overlay.
=== ⚠️ TEXT POLICY (VERY IMPORTANT) ⚠️ ===
DO NOT render ANY text in the image:
- No Japanese characters
- No English letters
- No numbers
- No punctuation

Instead, design the banner with a clear text-safe area for overlay:
1) A LARGE solid/gradient panel (40%+ of the banner) reserved for headline/sub/CTA overlay
2) A CTA BUTTON SHAPE (no text inside) with high click affordance (contrast + subtle glow)
3) Visual storytelling that matches this theme/concept (visual only): "${keyword}"

If purpose is "webinar": include event-like layout cues (speaker photo area, date/time badge SHAPES) but still NO TEXT.

=== DESIGN REQUIREMENTS ===
- Professional, modern, clean design
- High contrast (feed-optimized) and premium color grading
- Clear visual hierarchy
- Mobile-friendly (elements not too small)
- Avoid “generic stock photo” look; make it feel like a real high-performing Japanese paid ad
- No watermark, no signature, no logos unless provided as an image, no UI screenshots
`

  // 会社名がある場合（テキスト合成はアプリ側で行うため、画像内には描かせない）
  if (options.companyName) {
    prompt += `
=== COMPANY/BRAND NAME ===
Do NOT render the company name as text (NO TEXT rule).
Instead, keep a small clean corner area for potential brand overlay later.
Do NOT create any logo mark, emblem, seal, watermark, or fake brand icon.
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
If a brand name is present, do NOT render it (NO TEXT rule). Keep a clean corner area for overlay.
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
    if (options.personImage) {
      // 実際の人物画像が提供されている場合
      prompt += `
=== PERSON IMAGE (PROVIDED) ===
I am providing a person's photo. Please incorporate this person into the banner design.
Position them on one side of the banner (left or right), leaving space for text on the other side.
Blend the person naturally with the banner background and style.
The person should look professional and trustworthy in the context of the advertisement.
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
Return a high-quality ad banner image with NO TEXT.
Make sure there is a clear overlay area for text (solid/gradient panel) and a CTA button shape (no text).`

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
  const primaryModel = getImageModel()
  
  // 画像生成モデルの候補（失敗時に順次試行）
  // Gemini 3 Pro Image を優先（https://ai.google.dev/gemini-api/docs/gemini-3?hl=ja）
  const modelsToTry = [
    primaryModel,
    'gemini-3-pro-image-preview',
    'gemini-3-flash-preview',
  ].filter((v, i, a) => a.indexOf(v) === i) // 重複除去

  let lastError: Error | null = null

  for (const model of modelsToTry) {
    try {
      console.log(`Calling Image Generation with model: ${model}...`)
      
      const aspectRatio = getAspectRatio(size)
      const [w, h] = size.split('x').map((v) => Number(v))
      
      // Gemini 3 Pro Image / Flash 用のAPIコール（generateContent）
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
      if (options?.personImage) {
        try {
          const parsed = parseDataUrl(options.personImage)
          imageParts.push({ inlineData: { mimeType: parsed.mimeType, data: parsed.data } })
        } catch { /* ignore */ }
      }

      const requestBody = {
          contents: [
            {
              parts: [
                ...imageParts,
                {
                  text: [
                    prompt,
                    '',
                    '--- OUTPUT CONSTRAINTS ---',
                    `Aspect ratio: ${aspectRatio}`,
                    `Target size: ${size}px`,
                    `Return an IMAGE output (PNG)`,
                  ].join('\n'),
                },
              ],
            },
          ],
          generationConfig: {
            responseModalities: ['IMAGE', 'TEXT'],
            temperature: 0.4,
            maxOutputTokens: 1024,
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
          console.warn(`Model ${model} failed:`, response.status, errorText)
          throw new Error(`API Error: ${response.status} - ${errorText.substring(0, 200)}`)
        }
            
        const result = await response.json()
            
        // レスポンスから画像を抽出
        const parts = result?.candidates?.[0]?.content?.parts
        if (Array.isArray(parts)) {
          for (const part of parts) {
            const inline = (part as any)?.inlineData || (part as any)?.inline_data
            if (inline?.data) {
              console.log(`Image generated successfully with ${model}`)
              const rawBase64 = String(inline.data)
              const [w_num, h_num] = size.split('x').map(v => Number(v))
              const resized = await sharp(Buffer.from(rawBase64, 'base64'))
                .resize(
                  Number.isFinite(w_num) && Number.isFinite(h_num) && w_num > 0 && h_num > 0
                    ? { width: w_num, height: h_num, fit: 'cover', position: 'centre' }
                    : undefined
                )
                .png()
                .toBuffer()
              return { image: `data:image/png;base64,${resized.toString('base64')}`, model }
            }
          }
        }
        
        throw new Error(`Model ${model} returned no image data`)
    } catch (e: any) {
      console.error(`Error with ${model}:`, e.message)
      lastError = e
      continue // 次のモデルを試す
    }
  }
      
  throw lastError || new Error('全ての画像生成モデルで失敗しました。管理者にお問い合わせください。')
}

// 使用モデルの表示名を取得
export function getModelDisplayName(model: string): string {
  if (!model) return '不明'
  const lower = model.toLowerCase()
  if (lower === 'gemini-3-pro-image-preview') return 'Gemini 3 Pro Image'
  if (lower === 'gemini-3-flash-preview') return 'Gemini 3 Flash'
  if (lower === 'gemini-3-pro-preview') return 'Gemini 3 Pro'
  if (lower.includes('gemini-3-pro')) return 'Gemini 3 Pro'
  if (lower.includes('gemini-3-flash')) return 'Gemini 3 Flash'
  if (lower.includes('gemini-3')) return 'Gemini 3'
  if (lower.includes('imagen-3')) return 'Imagen 3'
  if (lower.includes('imagen')) return 'Imagen'
  if (lower.includes('gemini-2.0-pro')) return 'Gemini 2.0 Pro (Exp)'
  if (lower.includes('gemini-2.0-flash-exp-image')) return 'Gemini 2.0 Flash (Image Gen)'
  if (lower.includes('gemini-2.0-flash-exp')) return 'Gemini 2.0 Flash (Exp)'
  if (lower.includes('gemini-1.5-flash')) return 'Gemini 1.5 Flash'
  if (lower.includes('gemini-1.5-pro')) return 'Gemini 1.5 Pro'
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
    'Keep ALL constraints about Japanese text readability, font size, and solid text background.',
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
  options: GenerateOptions = {}
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

  console.log(`Starting ${isYouTube ? 'YouTube thumbnail' : 'banner'} generation with Nano Banana Pro`)
  console.log(`Category: ${category}, Purpose: ${options.purpose}, Size: ${size}`)
  console.log(`Model(Image/NanoBanana): ${imageModel}`)
  console.log(`Model(Text/Gemini): ${textModel}`)

  try {
    const banners: string[] = []
    const errors: string[] = []
    let usedModel: string | undefined = undefined
    
    // 3パターン順次生成（Nano Banana Pro のみ使用）
    for (const appealType of appealTypes) {
      try {
        const basePrompt = createBannerPrompt(category, keyword, size, appealType, options)
        console.log(`Generating ${isYouTube ? 'thumbnail' : 'banner'} type ${appealType.type} (${appealType.japanese})...`)
        
        let finalPrompt = basePrompt
        try {
          finalPrompt = await refinePromptWithGemini3Flash(basePrompt)
        } catch (e: any) {
          console.warn('Gemini prompt refine failed. Using base prompt.', e?.message || e)
        }

        const result = await generateSingleBanner(finalPrompt, size, options)
        
        banners.push(result.image)
        // 最初に成功したモデルを記録
        if (!usedModel) {
          usedModel = result.model
        }
        console.log(`${isYouTube ? 'Thumbnail' : 'Banner'} ${appealType.type} generated successfully with model: ${result.model}`)
        
        // レート制限を避けるため待機
        if (appealTypes.indexOf(appealType) < appealTypes.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
      } catch (error: any) {
        console.error(`${isYouTube ? 'Thumbnail' : 'Banner'} ${appealType.type} generation failed:`, error.message)
        errors.push(`${appealType.type}: ${error.message}`)
        // エラーの場合はプレースホルダー（エラー内容を表示）
        const [w, h] = size.split('x')
        banners.push(`https://placehold.co/${w}x${h}/EF4444/FFFFFF?text=Error:+Pattern+${appealType.type}`)
      }
    }

    console.log(`Generation complete. Used model: ${usedModel || 'unknown'}`)

    // 全て失敗した場合
    if (banners.every(b => b.startsWith('https://placehold'))) {
      return {
        banners,
        error: `⚠️ Nano Banana Pro で${isYouTube ? 'サムネイル' : 'バナー'}生成に失敗しました。\n\n【原因】\n${errors.join('\n')}\n\n【対処法】\n・GOOGLE_GENAI_API_KEY が正しいか確認\n・APIキーが有効になっているか確認\n・Google AI Studio でAPIキーを再発行してみてください`,
        usedModel: undefined,
      }
    }

    // 一部失敗した場合
    const failedCount = banners.filter(b => b.startsWith('https://placehold')).length
    if (failedCount > 0) {
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
