// Nano Banana Pro API (Gemini 3 Pro Image) を使用したバナー画像生成
// 参考: https://apidog.com/jp/blog/nano-banana-pro-api-jp/

// Google Gemini API エンドポイント
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'
// Nano Banana Pro モデルID
const MODEL_ID = 'gemini-2.0-flash-exp-image-generation'

// カテゴリ別のデザインガイドライン
const CATEGORY_STYLES: Record<string, { style: string; colors: string; elements: string }> = {
  telecom: {
    style: 'modern technology, clean professional',
    colors: 'vibrant blue, cyan, white gradient background',
    elements: 'smartphone icon, signal waves, cloud icon',
  },
  marketing: {
    style: 'sophisticated business, premium look',
    colors: 'purple, pink, white beautiful gradient',
    elements: 'rising graph, growth arrows, chart icons',
  },
  ec: {
    style: 'vibrant sale, urgency feeling',
    colors: 'orange, red, gold eye-catching',
    elements: 'shopping cart, gift box, sale tag, percent sign',
  },
  recruit: {
    style: 'bright hopeful professional friendly',
    colors: 'green, blue, white clean bright',
    elements: 'office building, handshake silhouette, teamwork',
  },
  beauty: {
    style: 'elegant refined feminine premium',
    colors: 'pink, rose gold, white soft',
    elements: 'flower illustration, cosmetic bottle, sparkle effects',
  },
  food: {
    style: 'delicious appetizing warm',
    colors: 'red, orange, brown',
    elements: 'food illustration, steam effect, fresh ingredients',
  },
}

// A/B/Cパターンの訴求タイプ
const APPEAL_TYPES = [
  { 
    type: 'A', 
    focus: 'Benefits focused', 
    style: 'Emphasize user benefits, positive bright design, main copy prominently displayed in center',
  },
  { 
    type: 'B', 
    focus: 'Urgency and scarcity', 
    style: 'Create urgency with "now" "limited" messaging, red and yellow accents, eye-catching design',
  },
  { 
    type: 'C', 
    focus: 'Trust and credibility', 
    style: 'Emphasize achievements like "No.1" "used by millions", calm colors for trust',
  },
]

// バナー生成用プロンプトを作成
function createBannerPrompt(
  category: string,
  keyword: string,
  size: string,
  appealType: typeof APPEAL_TYPES[0]
): string {
  const categoryStyle = CATEGORY_STYLES[category] || CATEGORY_STYLES.marketing
  const [width, height] = size.split('x')
  const aspectRatio = parseInt(width) > parseInt(height) ? 'landscape (horizontal)' : 
                      parseInt(width) < parseInt(height) ? 'portrait (vertical)' : 'square'

  return `Create a professional Japanese advertisement banner image.

SPECIFICATIONS:
- Format: ${aspectRatio} banner (${width}x${height} pixels aspect ratio)
- Style: ${categoryStyle.style} design
- Colors: ${categoryStyle.colors}
- Visual elements: ${categoryStyle.elements}
- Appeal type: ${appealType.focus} - ${appealType.style}

IMPORTANT - TEXT TO DISPLAY ON BANNER:
The following Japanese text MUST be clearly visible and readable on the banner:
"${keyword}"

DESIGN REQUIREMENTS:
1. Professional commercial advertisement quality
2. The Japanese text must be the focal point, large and clear
3. Include a CTA button (like "詳しくはこちら" or "今すぐチェック")
4. High quality, sharp, modern design
5. Good contrast between text and background
6. Clean layout with proper spacing

Generate the banner image now.`
}

// Nano Banana Pro APIを呼び出してバナーを生成
async function generateSingleBanner(
  apiKey: string,
  prompt: string
): Promise<string> {
  const endpoint = `${GEMINI_API_BASE}/models/${MODEL_ID}:generateContent?key=${apiKey}`
  
  console.log('Calling Nano Banana Pro API...')
  
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
    console.error('Nano Banana Pro API error:', response.status, errorText)
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

  // 画像が見つからない場合の詳細ログ
  console.error('No image in response. Full response:', JSON.stringify(result, null, 2).substring(0, 500))
  throw new Error('画像が生成されませんでした。モデルがテキストのみを返しました。')
}

// A/B/C 3パターンのバナーを生成
export async function generateBanners(
  category: string,
  keyword: string,
  size: string = '1080x1080'
): Promise<{ banners: string[]; error?: string }> {
  const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.NANOBANNER_API_KEY
  
  if (!apiKey) {
    console.error('API key not configured')
    return { 
      banners: [], 
      error: 'APIキーが設定されていません。環境変数 GOOGLE_GENAI_API_KEY を設定してください。' 
    }
  }

  console.log(`Starting banner generation - Category: ${category}, Keyword: ${keyword}, Size: ${size}`)

  try {
    const banners: string[] = []
    const errors: string[] = []
    
    // 3パターン順次生成
    for (const appealType of APPEAL_TYPES) {
      try {
        const prompt = createBannerPrompt(category, keyword, size, appealType)
        console.log(`Generating banner type ${appealType.type}...`)
        
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
