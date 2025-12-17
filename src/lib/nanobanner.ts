// ========================================
// Imagen 4 でバナー画像生成
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
// - imagen-4.0-generate-preview-05-20: Imagen 4 最新モデル
// - 高品質な画像生成、フォトリアリズム
// - ロゴや商品デザイン、タイポグラフィに最適
//
// ========================================

// Google AI Studio API 設定
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'
// Imagen 4 最新モデル
const IMAGEN_MODEL = 'imagen-4.0-generate-preview-05-20'

// APIキーを取得
function getApiKey(): string {
  const apiKey = process.env.GOOGLE_GENAI_API_KEY
  if (!apiKey) {
    throw new Error('GOOGLE_GENAI_API_KEY が設定されていません')
  }
  return apiKey
}

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

  let prompt = `Create a highly clickable YouTube thumbnail image (NO TEXT - visual design only).

=== YOUTUBE THUMBNAIL SPECIFICATIONS ===
Format: 16:9 landscape thumbnail (${width}x${height} pixels)
Platform: YouTube - must compete for attention among many thumbnails
Goal: MAXIMIZE click-through rate (CTR) through VISUALS ONLY

=== THUMBNAIL CONCEPT/THEME ===
"${keyword}"
Express this concept through visuals, NOT through text.

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

  // テキストの複雑さに基づいて戦略を決定
  const hasComplexJapanese = /[一-龯]/.test(keyword) // 漢字を含む
  const textLength = keyword.length
  
  // 短いテキストのみ直接レンダリング、それ以外はテキストエリアを確保
  const shouldRenderText = textLength <= 8 && !hasComplexJapanese

  let prompt = `Create a professional advertisement banner image for Japanese market.

=== BANNER SPECIFICATIONS ===
Format: ${aspectRatio} banner (${width}x${height} pixels)
Purpose: ${options.purpose || 'sns_ad'} - ${purposeStyle.layout}

=== DESIGN STYLE ===
Industry: ${categoryStyle.style}
Color palette: ${categoryStyle.colors}
Visual elements: ${categoryStyle.elements}

=== LAYOUT & EMPHASIS ===
${purposeStyle.emphasis}

=== APPEAL TYPE: ${appealType.focus} ===
${appealType.style}

=== ⚠️⚠️⚠️ TEXT HANDLING - VERY IMPORTANT ⚠️⚠️⚠️ ===

${shouldRenderText ? `
**SHORT TEXT MODE**: Render this short text directly:
"${keyword}"
- Use VERY LARGE, BOLD sans-serif font
- Place on solid color background
- Maximum contrast
` : `
**DESIGN-FOCUSED MODE**: 
DO NOT render any Japanese text or complex characters.
Instead, create a visually striking banner with:

1. **LARGE SOLID COLOR AREA** for text overlay (40% of banner)
   - Clean, flat color area at center or bottom
   - Semi-transparent gradient acceptable
   - This is where text will be added later

2. **VISUAL STORYTELLING**
   - Use imagery, icons, and graphics to convey the message
   - Theme/concept: "${keyword}"
   - Express the emotion and appeal through visuals, not text

3. **SIMPLE CTA BUTTON PLACEHOLDER**
   - Include a colorful button shape (no text inside)
   - Contrasting color from background
   - Positioned at bottom-right or center-bottom

4. **ABSOLUTELY NO TEXT**
   - No Japanese characters
   - No English text
   - No numbers
   - Just pure visual design with text placeholder areas
`}

=== DESIGN REQUIREMENTS ===
- Professional, modern, clean design
- High contrast and vibrant colors
- Clear visual hierarchy
- Mobile-friendly (elements not too small)
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
=== 🔴🔴🔴 MOST IMPORTANT: JAPANESE TEXT QUALITY 🔴🔴🔴 ===

**THE TEXT QUALITY IS THE #1 PRIORITY - MORE IMPORTANT THAN DESIGN**

REQUIRED TEXT: "${keyword}"

ABSOLUTE RULES FOR TEXT (MUST FOLLOW):

1. **TEXT STYLE**:
   - Use ONLY simple, clean BLOCK letters/characters
   - Japanese: Use thick, bold ゴシック (Gothic) style ONLY
   - NO cursive, NO handwriting, NO decorative fonts
   - Each character must be a simple, geometric shape

2. **TEXT SIZE**:
   - Main text: At least 15% of image HEIGHT
   - Each character must be clearly visible even at thumbnail size
   - If text is long, split into 2 lines maximum

3. **TEXT BACKGROUND**:
   - ALWAYS place text on a SOLID COLOR rectangle
   - The rectangle should have 90-100% opacity
   - Color contrast: White text on dark bg, OR dark text on light bg
   - Add 20px+ padding around all text

4. **TEXT RENDERING**:
   - Each Japanese character must be PERFECT and COMPLETE
   - 漢字 (Kanji): Every stroke must be visible and correct
   - ひらがな (Hiragana): Smooth, complete curves
   - カタカナ (Katakana): Sharp, complete angles
   - NO blurry, distorted, or partial characters

5. **TEXT POSITION**:
   - Center the main text horizontally
   - Keep text HORIZONTAL only (no rotation)
   - Never place text on busy/complex backgrounds without solid backing

6. **FORBIDDEN**:
   ❌ Decorative or stylized fonts
   ❌ Text smaller than 10% of image height
   ❌ Rotated or tilted text
   ❌ Text on transparent or semi-transparent backgrounds
   ❌ Overlapping text
   ❌ More than 3 text elements total
   ❌ Any text without solid color backing

=== FINAL CHECK ===
Before generating, verify:
1. Main text "${keyword}" will be large and perfectly readable
2. Text has solid color background
3. No decorative fonts
4. Maximum 3 text elements

Generate a HIGH-QUALITY banner with PERFECT Japanese text rendering now.`

  return prompt
}

// ========================================
// Gemini 2.5 Flash Image (Nano Banana) で画像生成
// 公式ドキュメント: https://ai.google.dev/gemini-api/docs/image-generation?hl=ja
// ========================================
async function generateSingleBanner(
  prompt: string,
  size: string = '1080x1080'
): Promise<string> {
  const apiKey = getApiKey()
  
  console.log('Calling Gemini 2.5 Flash Image (Nano Banana)...')
  console.log('Model:', GEMINI_IMAGE_MODEL)
  
  // Gemini generateContent API エンドポイント
  const endpoint = `${GEMINI_API_BASE}/models/${GEMINI_IMAGE_MODEL}:generateContent?key=${apiKey}`
  
  // 公式ドキュメントに従ったリクエスト形式
  const requestBody = {
    contents: [
      {
        parts: [
          { text: prompt }
        ]
      }
    ],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"]
    }
  }
  
  console.log('Calling Gemini API...')
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    console.error('Gemini API error:', response.status, errorText)
    throw new Error(`API Error: ${response.status} - ${errorText.substring(0, 300)}`)
  }
  
  const result = await response.json()
  console.log('Gemini API Response received')
  
  // レスポンスから画像を抽出（公式ドキュメントの形式）
  if (result.candidates && result.candidates[0]?.content?.parts) {
    for (const part of result.candidates[0].content.parts) {
      if (part.inlineData) {
        console.log('Image found in Gemini response!')
        const mimeType = part.inlineData.mimeType || 'image/png'
        return `data:${mimeType};base64,${part.inlineData.data}`
      }
    }
  }
  
  console.error('No image in response:', JSON.stringify(result, null, 2).substring(0, 500))
  throw new Error('画像が生成されませんでした。テキストのみの応答でした。')
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
): Promise<{ banners: string[]; error?: string }> {
  // APIキーの確認
  const apiKey = process.env.GOOGLE_GENAI_API_KEY
  if (!apiKey) {
    console.error('GOOGLE_GENAI_API_KEY not configured')
    return { 
      banners: [], 
      error: 'APIキーが設定されていません。環境変数 GOOGLE_GENAI_API_KEY を設定してください。' 
    }
  }

  const isYouTube = options.purpose === 'youtube'
  const appealTypes = isYouTube ? YOUTUBE_APPEAL_TYPES : APPEAL_TYPES

  console.log(`Starting ${isYouTube ? 'YouTube thumbnail' : 'banner'} generation with Imagen 4`)
  console.log(`Category: ${category}, Purpose: ${options.purpose}, Size: ${size}`)
  console.log(`Model: ${IMAGEN_MODEL}`)

  try {
    const banners: string[] = []
    const errors: string[] = []
    
    // 3パターン順次生成（Imagen 4 使用）
    for (const appealType of appealTypes) {
      try {
        const prompt = createBannerPrompt(category, keyword, size, appealType, options)
        console.log(`Generating ${isYouTube ? 'thumbnail' : 'banner'} type ${appealType.type} (${appealType.japanese})...`)
        
        // Imagen 4 で生成
        const banner = await generateSingleBanner(prompt, size)
        
        banners.push(banner)
        console.log(`${isYouTube ? 'Thumbnail' : 'Banner'} ${appealType.type} generated successfully!`)
        
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

    console.log(`Generation complete.`)

    // 全て失敗した場合
    if (banners.every(b => b.startsWith('https://placehold'))) {
      return {
        banners,
        error: `⚠️ Gemini 2.5 Flash Image で${isYouTube ? 'サムネイル' : 'バナー'}生成に失敗しました。\n\n【原因】\n${errors.join('\n')}\n\n【対処法】\n・GOOGLE_GENAI_API_KEY が正しいか確認\n・APIキーが有効になっているか確認\n・Google AI Studio でAPIキーを再発行してみてください`
      }
    }

    // 一部失敗した場合
    const failedCount = banners.filter(b => b.startsWith('https://placehold')).length
    if (failedCount > 0) {
      return { 
        banners,
        error: `⚠️ ${failedCount}件のパターンで生成に失敗しました。赤いプレースホルダーが表示されているパターンは再試行してください。`
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
