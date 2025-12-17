// Google Gemini API を使用したバナー画像生成
// Imagen 3 モデルで画像を生成

// Google AI Studio Gemini API エンドポイント
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'

// カテゴリ別のデザインガイドライン
const CATEGORY_STYLES: Record<string, { style: string; colors: string; elements: string }> = {
  telecom: {
    style: 'モダンでテクノロジー感のある、クリーンでプロフェッショナルな',
    colors: '鮮やかな青、シアン、白を基調とした、グラデーション背景の',
    elements: 'スマートフォンのアイコン、電波マーク、クラウドアイコン',
  },
  marketing: {
    style: '洗練されていて信頼感のある、ビジネス向けの高級感ある',
    colors: '紫、ピンク、白を基調とした、美しいグラデーション背景の',
    elements: '上昇するグラフ、成長を示す矢印、チャートアイコン',
  },
  ec: {
    style: '華やかで購買意欲を刺激する、セール感のある',
    colors: 'オレンジ、赤、金色を基調とした、目を引く鮮やかな',
    elements: 'ショッピングカート、ギフトボックス、セールタグ',
  },
  recruit: {
    style: '明るく前向きで希望に満ちた、プロフェッショナルな',
    colors: '緑、青、白を基調とした、クリーンで明るい',
    elements: 'オフィスビル、握手するシルエット、チームワーク',
  },
  beauty: {
    style: 'エレガントで洗練された、女性向けの高級感ある',
    colors: 'ピンク、ローズゴールド、白を基調とした、柔らかい',
    elements: '花のイラスト、化粧品ボトル、きらめきエフェクト',
  },
  food: {
    style: '美味しそうで食欲をそそる、温かみのある',
    colors: '赤、オレンジ、茶色を基調とした',
    elements: '料理のイラスト、湯気エフェクト、新鮮な食材',
  },
}

// A/B/Cパターンの訴求タイプ
const APPEAL_TYPES = [
  { 
    type: 'A', 
    focus: 'ベネフィット重視', 
    style: 'ユーザーのメリットを大きく強調し、ポジティブで明るいデザイン',
  },
  { 
    type: 'B', 
    focus: '緊急性・限定性', 
    style: '「今すぐ」「限定」などの緊急性を演出、赤や黄色のアクセント',
  },
  { 
    type: 'C', 
    focus: '信頼性・実績', 
    style: '実績を強調、落ち着いた配色で信頼感を演出',
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
  const aspectRatio = parseInt(width) > parseInt(height) ? '横長' : 
                      parseInt(width) < parseInt(height) ? '縦長' : '正方形'

  return `Create a professional Japanese advertisement banner image.

Size: ${aspectRatio} format (${width}x${height} pixels)
Style: ${categoryStyle.style} design
Colors: ${categoryStyle.colors} color scheme
Elements: ${categoryStyle.elements}

Appeal type: ${appealType.focus} - ${appealType.style}

Main copy text to display on the banner (in Japanese): "${keyword}"

Requirements:
- Professional commercial advertisement quality
- The Japanese text "${keyword}" must be clearly visible and readable
- Include a CTA button
- High quality, sharp image
- Modern and clean design

Generate only the image, no explanation needed.`
}

// Gemini APIを使って画像を生成
async function generateImageWithGemini(
  apiKey: string,
  prompt: string
): Promise<string> {
  // Gemini 2.0 Flash で画像生成
  const endpoint = `${GEMINI_API_BASE}/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`
  
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
        responseModalities: ["TEXT", "IMAGE"],
      },
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Gemini API error:', response.status, errorText)
    throw new Error(`API Error: ${response.status}`)
  }

  const result = await response.json()
  
  // レスポンスから画像データを抽出
  if (result.candidates && result.candidates[0]?.content?.parts) {
    for (const part of result.candidates[0].content.parts) {
      if (part.inlineData?.mimeType?.startsWith('image/')) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`
      }
    }
  }

  // 画像が生成されなかった場合、テキストレスポンスを確認
  console.log('Gemini response:', JSON.stringify(result, null, 2))
  throw new Error('画像が生成されませんでした')
}

// Imagen 3 APIを使って画像を生成（代替）
async function generateImageWithImagen(
  apiKey: string,
  prompt: string,
  size: string
): Promise<string> {
  const [width, height] = size.split('x').map(Number)
  const aspectRatio = width > height ? '16:9' : width < height ? '9:16' : '1:1'
  
  const endpoint = `${GEMINI_API_BASE}/models/imagen-3.0-generate-002:predict?key=${apiKey}`
  
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      instances: [{
        prompt: prompt
      }],
      parameters: {
        sampleCount: 1,
        aspectRatio: aspectRatio,
      }
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Imagen API error:', response.status, errorText)
    throw new Error(`Imagen API Error: ${response.status}`)
  }

  const result = await response.json()
  
  if (result.predictions && result.predictions[0]?.bytesBase64Encoded) {
    return `data:image/png;base64,${result.predictions[0].bytesBase64Encoded}`
  }

  throw new Error('Imagen: 画像が生成されませんでした')
}

// 単一のバナーを生成
async function generateSingleBanner(
  apiKey: string,
  prompt: string,
  size: string
): Promise<string> {
  try {
    // まずGemini 2.0で試す
    return await generateImageWithGemini(apiKey, prompt)
  } catch (error: any) {
    console.log('Gemini failed, trying Imagen...', error.message)
    try {
      // Imagenで再試行
      return await generateImageWithImagen(apiKey, prompt, size)
    } catch (imagenError: any) {
      console.error('Both APIs failed:', imagenError.message)
      throw error
    }
  }
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

  try {
    const banners: string[] = []
    
    // 3パターン順次生成
    for (const appealType of APPEAL_TYPES) {
      try {
        const prompt = createBannerPrompt(category, keyword, size, appealType)
        console.log(`Generating banner type ${appealType.type}...`)
        
        const banner = await generateSingleBanner(apiKey, prompt, size)
        banners.push(banner)
        
        // レート制限を避けるため待機
        if (APPEAL_TYPES.indexOf(appealType) < APPEAL_TYPES.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
      } catch (error: any) {
        console.error(`Banner ${appealType.type} generation failed:`, error)
        // エラーの場合はプレースホルダー
        const [w, h] = size.split('x')
        banners.push(`https://placehold.co/${w}x${h}/8B5CF6/FFFFFF?text=Pattern+${appealType.type}`)
      }
    }

    if (banners.every(b => b.startsWith('https://placehold'))) {
      return {
        banners,
        error: 'バナー生成に失敗しました。APIキーを確認してください。'
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
