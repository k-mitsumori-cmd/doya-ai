import { NextRequest, NextResponse } from 'next/server'

// ========================================
// バナー修正API（再生成方式）
// ========================================
// POST /api/banner/refine
// 生成済みバナーの修正指示を受け、新たにバナーを再生成
// 
// ※ Imagen 3 (Gemini 3.0) は画像入力に対応していないため、
//   画像編集ではなく、指示に基づいて新規生成を行います

const GEMINI_API_KEY = process.env.GOOGLE_GENAI_API_KEY

// Imagen 3 (Gemini 3.0) - 唯一使用するモデル
const API_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict'

interface RefineRequest {
  originalImage: string  // 参考用（実際には使用しない）
  instruction: string    // 修正指示
  category?: string
  size?: string
  originalPrompt?: string  // 元のプロンプト情報
}

interface RefineResponse {
  success: boolean
  refinedImage?: string
  error?: string
  message?: string
}

export async function POST(request: NextRequest): Promise<NextResponse<RefineResponse>> {
  try {
    const body: RefineRequest = await request.json()
    const { instruction, category, size } = body

    if (!instruction || instruction.trim().length < 3) {
      return NextResponse.json({
        success: false,
        error: '修正指示を入力してください（3文字以上）',
      }, { status: 400 })
    }

    // APIキーチェック
    if (!GEMINI_API_KEY) {
      console.warn('GOOGLE_GENAI_API_KEY not set, returning error')
      return NextResponse.json({
        success: false,
        error: 'APIキーが設定されていません',
      }, { status: 500 })
    }

    // Imagen 3で新規生成
    const prompt = createRegeneratePrompt(instruction, category, size)
    
    const apiUrl = `${API_ENDPOINT}?key=${GEMINI_API_KEY}`
    
    const requestBody = {
      instances: [{ prompt }],
      parameters: {
        sampleCount: 1,
        aspectRatio: getAspectRatio(size),
        safetyFilterLevel: 'block_only_high',
        personGeneration: 'allow_adult',
      },
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Imagen 3 API error:', response.status, errorText)
      throw new Error(`API Error: ${response.status}`)
    }

    const data = await response.json()

    // 画像を抽出
    const predictions = data.predictions || []
    if (predictions.length === 0 || !predictions[0].bytesBase64Encoded) {
      throw new Error('No image in response')
    }

    const refinedImage = `data:image/png;base64,${predictions[0].bytesBase64Encoded}`

    return NextResponse.json({
      success: true,
      refinedImage,
      message: '指示に基づいて新しいバナーを生成しました',
    })

  } catch (error: any) {
    console.error('Banner refine error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'バナーの再生成に失敗しました',
    }, { status: 500 })
  }
}

function getAspectRatio(size?: string): string {
  if (!size) return '1:1'
  const [width, height] = size.split('x').map(Number)
  if (!width || !height) return '1:1'
  
  const ratio = width / height
  if (ratio > 1.5) return '16:9'
  if (ratio > 1.2) return '4:3'
  if (ratio < 0.67) return '9:16'
  if (ratio < 0.8) return '3:4'
  return '1:1'
}

function createRegeneratePrompt(instruction: string, category?: string, size?: string): string {
  return `Create a professional advertisement banner based on these requirements:

**USER'S REQUEST:** ${instruction}

${category ? `**INDUSTRY:** ${category}` : ''}
${size ? `**TARGET SIZE:** ${size}` : ''}

=== DESIGN REQUIREMENTS ===

1. **VISUAL-FOCUSED DESIGN**
   - Create a visually striking banner
   - Express the concept through imagery and colors
   - Reserve 40% of the space as a solid color area for text overlay

2. **NO TEXT RULE**
   - DO NOT include any text, characters, or letters
   - All text will be added in post-production
   - Create visual placeholder areas with solid colors

3. **PROFESSIONAL QUALITY**
   - Modern, clean, high-quality design
   - Vibrant colors with high contrast
   - Mobile-friendly with clear visual hierarchy

4. **LAYOUT**
   - Clear focal point
   - Balanced composition
   - Space for text overlay (solid color block)

Generate the banner now with NO TEXT.`
}

