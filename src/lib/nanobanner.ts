// Nano Banana Pro API (Gemini 3 Pro Image) を使用したバナー画像生成
// 参考: https://apidog.com/jp/blog/nano-banana-pro-api-jp/

// Google Gemini API エンドポイント
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'
// Gemini 3 Pro Image (Nano Banana Pro) モデルID
const MODEL_ID = 'gemini-2.0-flash-exp-image-generation'

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

// 生成オプションの型定義
interface GenerateOptions {
  purpose?: string
  companyName?: string
  hasLogo?: boolean
  hasPerson?: boolean
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
`

  // 会社名がある場合
  if (options.companyName) {
    prompt += `
=== COMPANY/BRAND NAME ===
Display "${options.companyName}" as the brand name (smaller than main text, but visible)
`
  }

  // ロゴがある場合のプレースホルダー指示
  if (options.hasLogo) {
    prompt += `
=== LOGO PLACEMENT ===
Leave space for a company logo in the corner (top-left or bottom-right recommended)
`
  }

  // 人物がある場合のプレースホルダー指示
  if (options.hasPerson) {
    prompt += `
=== PERSON IMAGE ===
Include a professional-looking person (business professional, friendly expression)
Position them on one side of the banner, leaving space for text on the other side
`
  }

  prompt += `
=== FINAL REQUIREMENTS ===
1. Professional commercial advertisement quality
2. Japanese text "${keyword}" must be clearly visible and readable
3. Good contrast between text and background
4. Modern, clean, high-quality design
5. Include the specified CTA button

Generate the banner image now.`

  return prompt
}

// Gemini APIを使って画像を生成
async function generateSingleBanner(
  apiKey: string,
  prompt: string
): Promise<string> {
  const endpoint = `${GEMINI_API_BASE}/models/${MODEL_ID}:generateContent?key=${apiKey}`
  
  console.log('Calling Gemini Image API...')
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: prompt }]
      }],
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
    console.error('Gemini API error:', response.status, errorText)
    throw new Error(`API Error: ${response.status} - ${errorText.substring(0, 200)}`)
  }

  const result = await response.json()
  console.log('API Response received')
  
  // レスポンスから画像データを抽出
  if (result.candidates && result.candidates[0]?.content?.parts) {
    for (const part of result.candidates[0].content.parts) {
      if (part.inlineData?.mimeType?.startsWith('image/')) {
        console.log('Image found in response!')
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

  console.log(`Starting banner generation - Category: ${category}, Purpose: ${options.purpose}, Size: ${size}`)

  try {
    const banners: string[] = []
    const errors: string[] = []
    
    // 3パターン順次生成
    for (const appealType of APPEAL_TYPES) {
      try {
        const prompt = createBannerPrompt(category, keyword, size, appealType, options)
        console.log(`Generating banner type ${appealType.type} (${appealType.japanese})...`)
        
        const banner = await generateSingleBanner(apiKey, prompt)
        banners.push(banner)
        console.log(`Banner ${appealType.type} generated successfully!`)
        
        // レート制限を避けるため待機
        if (APPEAL_TYPES.indexOf(appealType) < APPEAL_TYPES.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
      } catch (error: any) {
        console.error(`Banner ${appealType.type} generation failed:`, error.message)
        errors.push(`${appealType.type}: ${error.message}`)
        // エラーの場合はプレースホルダー
        const [w, h] = size.split('x')
        banners.push(`https://placehold.co/${w}x${h}/8B5CF6/FFFFFF?text=Pattern+${appealType.type}`)
      }
    }

    // 全て失敗した場合
    if (banners.every(b => b.startsWith('https://placehold'))) {
      return {
        banners,
        error: `バナー生成に失敗しました: ${errors.join(', ')}`
      }
    }

    return { banners }
  } catch (error: any) {
    console.error('generateBanners error:', error)
    return { 
      banners: [], 
      error: error.message || 'バナー生成中にエラーが発生しました' 
    }
  }
}

// 環境変数のチェック
export function isNanobannerConfigured(): boolean {
  return !!(process.env.GOOGLE_GENAI_API_KEY || process.env.NANOBANNER_API_KEY)
}
