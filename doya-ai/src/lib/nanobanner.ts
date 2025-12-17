// Nano Banana Pro API (Gemini Imagen 3) を使用したバナー画像生成
// 参考: https://apidog.com/jp/blog/nano-banana-pro-api-jp/

// Google Gemini API エンドポイント
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'

// ========================================
// Imagen 3 (Nano Banana Pro)
// これが画像生成に使用される唯一のモデル
// 高品質な画像生成とテキストレンダリングに優れている
// ========================================
const IMAGE_MODEL_ID = 'imagen-3.0-generate-002'

// リトライ設定（テキスト崩れ時の再生成用）
const MAX_RETRIES = 2
const RETRY_DELAY_MS = 1000

// 業種カテゴリ別のデザインガイドライン
const CATEGORY_STYLES: Record<string, { style: string; colors: string; elements: string }> = {
  telecom: {
    style: 'modern technology, clean professional',
    colors: 'vibrant blue (#3B82F6), cyan (#06B6D4), white gradient',
    elements: 'smartphone, signal waves, cloud icons, speed arrows',
  },
  marketing: {
    style: 'sophisticated business, premium professional',
    colors: 'purple (#8B5CF6), pink (#EC4899), white gradient',
    elements: 'rising graphs, growth arrows, chart icons, data visualization',
  },
  ec: {
    style: 'vibrant sale, urgency, shopping excitement',
    colors: 'orange (#F97316), red (#EF4444), gold accents',
    elements: 'shopping cart, gift boxes, sale tags, percent signs, ribbons',
  },
  recruit: {
    style: 'bright hopeful, professional friendly, career growth',
    colors: 'green (#22C55E), blue (#3B82F6), white clean',
    elements: 'office buildings, handshake, teamwork silhouettes, career ladder',
  },
  beauty: {
    style: 'elegant refined, feminine premium, luxurious',
    colors: 'pink (#EC4899), rose gold, white soft',
    elements: 'flowers, cosmetic bottles, sparkles, ribbons, elegant patterns',
  },
  food: {
    style: 'delicious appetizing, warm inviting, fresh',
    colors: 'red (#EF4444), orange (#F97316), brown warm tones',
    elements: 'food imagery, steam effects, fresh ingredients, restaurant ambiance',
  },
  realestate: {
    style: 'trustworthy stable, professional, premium living',
    colors: 'teal (#14B8A6), emerald (#10B981), white clean',
    elements: 'buildings, houses, keys, location pins, modern architecture',
  },
  education: {
    style: 'inspiring learning, academic, knowledge growth',
    colors: 'indigo (#6366F1), blue (#3B82F6), white clean',
    elements: 'books, graduation caps, light bulbs, academic icons',
  },
  finance: {
    style: 'trustworthy secure, professional, wealth growth',
    colors: 'yellow (#EAB308), amber (#F59E0B), navy blue',
    elements: 'coins, graphs, secure locks, growth charts, financial icons',
  },
  health: {
    style: 'caring professional, clean medical, trustworthy',
    colors: 'cyan (#06B6D4), teal (#14B8A6), white clean',
    elements: 'medical crosses, hearts, caring hands, health icons',
  },
  it: {
    style: 'innovative tech, modern digital, cutting-edge',
    colors: 'violet (#8B5CF6), purple (#A855F7), dark gradient',
    elements: 'code snippets, circuits, cloud, AI icons, digital patterns',
  },
  other: {
    style: 'professional clean, versatile modern',
    colors: 'gray (#6B7280), slate (#475569), white gradient',
    elements: 'abstract geometric shapes, professional icons',
  },
}

// 用途別のデザインガイドライン
const PURPOSE_STYLES: Record<string, { layout: string; emphasis: string; cta: string }> = {
  sns_ad: {
    layout: 'eye-catching social media ad, thumb-stopping design, mobile-first',
    emphasis: 'bold headline centered, clear value proposition',
    cta: 'prominent CTA button like "詳しくはこちら" or "今すぐチェック"',
  },
  youtube: {
    layout: 'YouTube thumbnail, 16:9 aspect ratio, maximum visual impact, designed to get clicks in search results and recommendations',
    emphasis: 'HUGE bold text that fills most of the frame, expressive face/reaction shot area, bright contrasting colors, dramatic lighting effects',
    cta: 'NO CTA button needed - focus on emotional hook and curiosity gap, use arrows or circles to draw attention if needed',
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
    style: 'Emphasize user benefits and value, positive bright design, main copy prominently displayed',
    japanese: 'ベネフィット重視',
  },
  { 
    type: 'B', 
    focus: 'Urgency and scarcity', 
    style: 'Create urgency with "now" "limited" "last chance" messaging, red/yellow accents, dynamic design',
    japanese: '緊急性・限定性',
  },
  { 
    type: 'C', 
    focus: 'Trust and credibility', 
    style: 'Emphasize achievements "No.1" "used by millions" stats, calm professional colors, trustworthy feel',
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
interface GenerateOptions {
  purpose?: string
  companyName?: string
  hasLogo?: boolean
  hasPerson?: boolean
  logoDescription?: string  // ロゴの説明（例: "青い円形のロゴ"）
  personDescription?: string  // 人物の説明（例: "30代女性ビジネスパーソン"）
  logoImage?: string  // ロゴ画像のBase64データ（data:image/...;base64,...形式）
  personImage?: string  // 人物画像のBase64データ
}

// YouTubeサムネイル専用プロンプト生成
function createYouTubeThumbnailPrompt(
  keyword: string,
  size: string,
  appealType: typeof YOUTUBE_APPEAL_TYPES[0],
  options: GenerateOptions = {}
): string {
  const [width, height] = size.split('x')

  let prompt = `Create a highly clickable YouTube thumbnail image that will stand out in search results and recommendations.

=== YOUTUBE THUMBNAIL SPECIFICATIONS ===
Format: 16:9 landscape thumbnail (${width}x${height} pixels)
Platform: YouTube - must compete for attention among many thumbnails
Goal: MAXIMIZE click-through rate (CTR)

=== THUMBNAIL TITLE/HOOK ===
"${keyword}"

=== STYLE: ${appealType.focus} ===
${appealType.style}

=== YOUTUBE THUMBNAIL BEST PRACTICES ===
1. **HUGE, BOLD TEXT**: 
   - Main text should fill 40-60% of the thumbnail area
   - Use thick, bold fonts with strong outlines
   - Maximum 2-3 lines of text, preferably less
   - Text must be readable at 120x67px (mobile preview size)

2. **HIGH CONTRAST & SATURATION**:
   - Use bright, saturated colors (no muted tones)
   - Strong contrast between text and background
   - Consider using complementary color schemes
   - Add glow, shadow, or stroke to text for pop

3. **VISUAL HIERARCHY**:
   - One clear focal point (text OR face, not competing)
   - Use arrows, circles, or lines to direct attention
   - Left side often performs better for human faces
   - Right side good for key text or product

4. **EMOTIONAL IMPACT**:
   - Include space for expressive human face if relevant
   - Show emotion: surprise, excitement, curiosity
   - Use visual metaphors (explosions, fire, arrows, etc.)
   - Create before/after or contrast visuals if applicable

5. **AVOID**:
   - Small or decorative fonts
   - Too much text (keep it punchy)
   - Cluttered backgrounds
   - Low contrast elements
   - Generic stock photo feel

=== ⚠️ CRITICAL: JAPANESE TEXT RULES ⚠️ ===
1. **EXTRA LARGE FONT**: Japanese text must be at least 30% of thumbnail height
2. **BOLD GOTHIC FONT**: Use thick, bold Japanese Gothic/Sans-serif
3. **STRONG OUTLINE**: Add 3-5px stroke/outline around Japanese text
4. **NO CORRUPTION**: 
   - Each kanji/hiragana/katakana must be perfect
   - No stretching, no distortion
   - Keep text strictly horizontal
5. **LIMIT TEXT**: Maximum 10-15 Japanese characters total
6. **SOLID BACKING**: Always place text on solid or gradient background, not on busy images
`

  // チャンネル名がある場合
  if (options.companyName) {
    prompt += `
=== CHANNEL BRANDING ===
Include "${options.companyName}" as small channel branding in corner (optional, subtle)
`
  }

  // 人物画像がある場合
  if (options.hasPerson) {
    if (options.personImage) {
      prompt += `
=== PERSON IMAGE (PROVIDED) ===
I am providing a person's photo to include in this thumbnail.
Position them on the left or right third of the frame.
The person should have an engaging, expressive pose suitable for YouTube.
Leave the opposite side for the main title text.
`
    } else {
      prompt += `
=== PERSON PLACEHOLDER ===
Include space for an expressive human face on one side of the thumbnail.
${options.personDescription ? `Person appearance: ${options.personDescription}` : 'A YouTuber with an engaging, expressive reaction face'}
Position on left side, with text on right side.
`
    }
  }

  prompt += `
=== FINAL OUTPUT ===
Generate a YouTube thumbnail that would make viewers WANT to click.
The thumbnail must:
1. Be instantly eye-catching at any size
2. Clearly communicate the video's hook/value
3. Have perfectly readable Japanese text
4. Look professional yet exciting
5. Stand out against competitors

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
  const aspectRatio = parseInt(width) > parseInt(height) ? 'landscape (horizontal)' : 
                      parseInt(width) < parseInt(height) ? 'portrait (vertical)' : 'square'
  
  const isYouTube = options.purpose === 'youtube'

  // YouTube専用プロンプト
  if (isYouTube) {
    return createYouTubeThumbnailPrompt(keyword, size, appealType, options)
  }

  let prompt = `Create a professional Japanese advertisement banner image.

=== BANNER SPECIFICATIONS ===
Format: ${aspectRatio} banner (${width}x${height} pixels aspect ratio)
Purpose: ${options.purpose || 'sns_ad'} - ${purposeStyle.layout}

=== DESIGN STYLE ===
Industry: ${categoryStyle.style}
Color palette: ${categoryStyle.colors}
Visual elements: ${categoryStyle.elements}

=== LAYOUT & EMPHASIS ===
${purposeStyle.emphasis}
CTA: ${purposeStyle.cta}

=== APPEAL TYPE: ${appealType.focus} ===
${appealType.style}

=== MAIN TEXT (MUST BE DISPLAYED IN JAPANESE) ===
"${keyword}"
This Japanese text MUST be the focal point, large, clear, and readable.

=== ⚠️ CRITICAL: JAPANESE TEXT RENDERING RULES ⚠️ ===
1. **MINIMUM FONT SIZE**: All text must be at least 24px equivalent (relative to 1080px width)
2. **NO SMALL TEXT**: Do NOT include any text smaller than 5% of the banner width
3. **JAPANESE FONT INTEGRITY**: 
   - Use clean, simple Japanese fonts (Gothic/Sans-serif style)
   - Each Japanese character must be complete and undistorted
   - Avoid decorative fonts that may corrupt kanji/hiragana/katakana
   - Ensure proper stroke rendering for all characters
4. **TEXT CLARITY**: 
   - High contrast between text and background (minimum 4.5:1 ratio)
   - Add subtle text shadow or outline for readability
   - No text on complex backgrounds without solid backing
5. **CHARACTER SPACING**: Maintain proper kerning for Japanese text
6. **AVOID TEXT CORRUPTION**:
   - Do NOT stretch or compress Japanese characters
   - Do NOT apply extreme perspective transforms to text
   - Keep text horizontal (no extreme rotations)
   - Avoid overlapping text elements
7. **LIMIT TEXT ELEMENTS**: Maximum 3 text elements total (headline, subtext, CTA)
`

  // 会社名がある場合
  if (options.companyName) {
    prompt += `
=== COMPANY/BRAND NAME ===
Display "${options.companyName}" as the brand name (smaller than main text, but visible)
`
  }

  // ロゴがある場合
  if (options.hasLogo) {
    if (options.logoImage) {
      // 実際のロゴ画像が提供されている場合
      prompt += `
=== LOGO PLACEMENT (PROVIDED) ===
I am providing the company logo image. Please incorporate this logo into the banner design.
Place the logo in a visible corner (top-left or bottom-right recommended).
Maintain the logo's original colors and shape, blending it naturally with the banner design.
`
    } else {
      // ロゴ画像がない場合はプレースホルダー
      prompt += `
=== LOGO PLACEHOLDER ===
Include a company logo placeholder in the corner (top-left or bottom-right recommended)
${options.logoDescription ? `Logo style: ${options.logoDescription}` : 'Create a simple, professional logo placeholder'}
`
    }
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
=== ⚠️⚠️⚠️ ABSOLUTE REQUIREMENTS FOR JAPANESE TEXT ⚠️⚠️⚠️ ===

**THIS IS THE MOST IMPORTANT PART - JAPANESE TEXT MUST BE PERFECT**

TEXT TO DISPLAY: "${keyword}"

MANDATORY TEXT RULES:
1. **FONT CHOICE**: Use ONLY clean, modern Japanese Gothic/Sans-serif fonts
   - Examples: Noto Sans JP, Hiragino Kaku Gothic, Meiryo Gothic
   - DO NOT use decorative, handwritten, or stylized fonts
   
2. **TEXT SIZE**: Main headline must occupy at least 30% of banner width
   - All text must be clearly readable even when thumbnail-sized
   - CTA button text must be at least 20% of banner width
   
3. **TEXT RENDERING**:
   - Render each Japanese character PERFECTLY with all strokes visible
   - Kanji (漢字) must have all radicals and strokes complete
   - Hiragana (ひらがな) must have smooth, unbroken curves
   - Katakana (カタカナ) must have sharp, clean angles
   - DO NOT generate corrupted, broken, or partial characters
   
4. **TEXT PLACEMENT**:
   - Place text on SOLID COLOR backgrounds (not on photos/gradients)
   - Add a semi-transparent solid rectangle behind text if needed
   - Never place text where it overlaps with complex imagery
   - Keep at least 10% padding around text edges
   
5. **TEXT EFFECTS**:
   - Add thick (3-5px) white or dark outline/stroke around text
   - Use drop shadow for depth (offset: 2-4px, blur: 4-8px)
   - Maintain at least 7:1 contrast ratio between text and background
   
6. **FORBIDDEN**:
   ❌ Text smaller than 5% of image height
   ❌ Stretched or compressed characters
   ❌ Rotated or perspective-transformed text
   ❌ Overlapping text elements
   ❌ Text on busy/noisy backgrounds without backing
   ❌ More than 3 separate text elements
   ❌ Decorative or artistic fonts that sacrifice readability

=== FINAL OUTPUT ===
Generate a professional Japanese advertisement banner.
The text "${keyword}" must be:
- Crystal clear and perfectly readable
- Large and prominent
- On a solid or semi-solid background
- With proper outline/shadow for visibility

Every single Japanese character must be 100% correct and complete.
Quality over complexity - if unsure, make it simpler and text larger.

Generate the banner image now.`

  return prompt
}

// Base64データからmimeTypeとデータを抽出
function parseBase64Image(base64: string): { mimeType: string; data: string } | null {
  const match = base64.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) return null
  return { mimeType: match[1], data: match[2] }
}

// ========================================
// Imagen 3 (Nano Banana Pro) APIを使った画像生成
// ========================================
async function generateSingleBanner(
  apiKey: string,
  prompt: string,
  inputImages?: { logo?: string; person?: string }
): Promise<string> {
  // Imagen 3 API用のエンドポイント
  const endpoint = `${GEMINI_API_BASE}/models/${IMAGE_MODEL_ID}:predict?key=${apiKey}`
  
  console.log('Calling Imagen 3 API...')
  console.log('Model:', IMAGE_MODEL_ID)
  
  // Imagen 3 API用のリクエストボディ
  // 参考: https://cloud.google.com/vertex-ai/generative-ai/docs/image/generate-images
  const requestBody = {
    instances: [
      {
        prompt: prompt
      }
    ],
    parameters: {
      sampleCount: 1,
      aspectRatio: "1:1",
      safetyFilterLevel: "block_few",
      personGeneration: "allow_adult",
      outputOptions: {
        mimeType: "image/png"
      }
    }
  }
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Imagen 3 API error:', response.status, errorText)
    
    // Imagen 3がエラーの場合、Gemini 2.0 Flash Exp Image Generationにフォールバック
    console.log('Falling back to Gemini 2.0 Flash Exp Image Generation...')
    return await generateWithGeminiFlash(apiKey, prompt, inputImages)
  }

  const result = await response.json()
  console.log('Imagen 3 API Response received')
  
  // Imagen 3のレスポンス形式から画像を抽出
  if (result.predictions && result.predictions[0]) {
    const prediction = result.predictions[0]
    if (prediction.bytesBase64Encoded) {
      console.log('Image found in Imagen 3 response!')
      return `data:image/png;base64,${prediction.bytesBase64Encoded}`
    }
  }
  
  console.error('No image in Imagen 3 response. Full response:', JSON.stringify(result, null, 2).substring(0, 500))
  throw new Error('画像が生成されませんでした。')
}

// Gemini 2.0 Flash Exp Image Generation（フォールバック用）
async function generateWithGeminiFlash(
  apiKey: string,
  prompt: string,
  inputImages?: { logo?: string; person?: string }
): Promise<string> {
  const FALLBACK_MODEL = 'gemini-2.0-flash-exp-image-generation'
  const endpoint = `${GEMINI_API_BASE}/models/${FALLBACK_MODEL}:generateContent?key=${apiKey}`
  
  console.log('Using Gemini 2.0 Flash Exp Image Generation...')
  
  // partsを構築（テキスト + 入力画像）
  const parts: any[] = [{ text: prompt }]
  
  // ロゴ画像を追加
  if (inputImages?.logo) {
    const parsed = parseBase64Image(inputImages.logo)
    if (parsed) {
      parts.push({
        inline_data: {
          mime_type: parsed.mimeType,
          data: parsed.data
        }
      })
      console.log('Logo image added to request')
    }
  }
  
  // 人物画像を追加
  if (inputImages?.person) {
    const parsed = parseBase64Image(inputImages.person)
    if (parsed) {
      parts.push({
        inline_data: {
          mime_type: parsed.mimeType,
          data: parsed.data
        }
      })
      console.log('Person image added to request')
    }
  }
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        responseModalities: ["IMAGE", "TEXT"],
        temperature: 1.0,
        topP: 0.95,
        topK: 40,
      },
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
      ],
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Gemini Flash API error:', response.status, errorText)
    throw new Error(`API Error: ${response.status} - ${errorText.substring(0, 200)}`)
  }

  const result = await response.json()
  console.log('Gemini Flash API Response received')
  
  // レスポンスから画像データを抽出
  if (result.candidates && result.candidates[0]?.content?.parts) {
    for (const part of result.candidates[0].content.parts) {
      if (part.inlineData?.mimeType?.startsWith('image/')) {
        console.log('Image found in Gemini Flash response!')
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`
      }
    }
  }

  console.error('No image in response. Full response:', JSON.stringify(result, null, 2).substring(0, 500))
  throw new Error('画像が生成されませんでした。モデルがテキストのみを返しました。')
}

// A/B/C 3パターンのバナーを生成
export async function generateBanners(
  category: string,
  keyword: string,
  size: string = '1080x1080',
  options: GenerateOptions = {}
): Promise<{ banners: string[]; error?: string }> {
  const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.NANOBANNER_API_KEY
  
  if (!apiKey) {
    console.error('API key not configured')
    return { 
      banners: [], 
      error: 'APIキーが設定されていません。環境変数 GOOGLE_GENAI_API_KEY を設定してください。' 
    }
  }

  const isYouTube = options.purpose === 'youtube'
  const appealTypes = isYouTube ? YOUTUBE_APPEAL_TYPES : APPEAL_TYPES

  console.log(`Starting ${isYouTube ? 'YouTube thumbnail' : 'banner'} generation - Category: ${category}, Purpose: ${options.purpose}, Size: ${size}`)
  
  // 入力画像を準備
  const inputImages = {
    logo: options.logoImage,
    person: options.personImage,
  }
  const hasInputImages = !!(inputImages.logo || inputImages.person)
  if (hasInputImages) {
    console.log(`Input images: logo=${!!inputImages.logo}, person=${!!inputImages.person}`)
  }

  try {
    const banners: string[] = []
    const errors: string[] = []
    
    // 3パターン順次生成（Gemini 3 Pro Image使用）
    for (const appealType of appealTypes) {
      try {
        const prompt = createBannerPrompt(category, keyword, size, appealType, options)
        console.log(`Generating ${isYouTube ? 'thumbnail' : 'banner'} type ${appealType.type} (${appealType.japanese})...`)
        
        // Gemini 3 Pro Image で生成
        const banner = await generateSingleBanner(
          apiKey, 
          prompt, 
          hasInputImages ? inputImages : undefined
        )
        
        banners.push(banner)
        console.log(`${isYouTube ? 'Thumbnail' : 'Banner'} ${appealType.type} generated successfully!`)
        
        // レート制限を避けるため待機
        if (appealTypes.indexOf(appealType) < appealTypes.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
      } catch (error: any) {
        console.error(`${isYouTube ? 'Thumbnail' : 'Banner'} ${appealType.type} generation failed:`, error.message)
        errors.push(`${appealType.type}: ${error.message}`)
        // エラーの場合はプレースホルダー
        const [w, h] = size.split('x')
        banners.push(`https://placehold.co/${w}x${h}/8B5CF6/FFFFFF?text=Pattern+${appealType.type}`)
      }
    }

    console.log(`Generation complete.`)

    // 全て失敗した場合
    if (banners.every(b => b.startsWith('https://placehold'))) {
      return {
        banners,
        error: `${isYouTube ? 'サムネイル' : 'バナー'}生成に失敗しました: ${errors.join(', ')}`
      }
    }

    return { banners }
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
  return !!(process.env.GOOGLE_GENAI_API_KEY || process.env.NANOBANNER_API_KEY)
}
