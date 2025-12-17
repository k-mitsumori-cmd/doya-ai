import { NextRequest, NextResponse } from 'next/server'

// ========================================
// バナー修正API
// ========================================
// POST /api/banner/refine
// 修正指示に基づいて新しいバナーを生成
// Vertex AI Imagen 3 を使用

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID || 'your-project-id'
const LOCATION = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1'
const IMAGEN_MODEL = 'imagen-3.0-generate-002'

interface RefineRequest {
  originalImage: string  // 参考用
  instruction: string    // 修正指示
  category?: string
  size?: string
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

    // プロジェクトIDチェック
    if (!PROJECT_ID || PROJECT_ID === 'your-project-id') {
      return NextResponse.json({
        success: false,
        error: 'GOOGLE_CLOUD_PROJECT_ID が設定されていません',
      }, { status: 500 })
    }

    // プロンプト生成
    const prompt = createRegeneratePrompt(instruction, category, size)
    const aspectRatio = getAspectRatio(size)
    
    // Vertex AI REST API 呼び出し
    const accessToken = process.env.GOOGLE_CLOUD_ACCESS_TOKEN
    
    if (!accessToken) {
      return NextResponse.json({
        success: false,
        error: 'GOOGLE_CLOUD_ACCESS_TOKEN が設定されていません',
      }, { status: 500 })
    }
    
    const endpoint = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/${IMAGEN_MODEL}:predict`
    
    const requestBody = {
      instances: [{ prompt }],
      parameters: {
        sampleCount: 1,
        aspectRatio: aspectRatio,
        safetyFilterLevel: 'block_few',
        personGeneration: 'allow_adult',
      },
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Imagen 3 API error:', response.status, errorText)
      throw new Error(`API Error: ${response.status}`)
    }

    const data = await response.json()

    // 画像を抽出
    if (!data.predictions?.[0]?.bytesBase64Encoded) {
      throw new Error('No image in response')
    }

    const refinedImage = `data:image/png;base64,${data.predictions[0].bytesBase64Encoded}`

    return NextResponse.json({
      success: true,
      refinedImage,
      message: 'Vertex AI Imagen 3 で新しいバナーを生成しました',
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
  if (ratio > 1.7) return '16:9'
  if (ratio > 1.4) return '3:2'
  if (ratio > 1.1) return '4:3'
  if (ratio < 0.6) return '9:16'
  if (ratio < 0.75) return '2:3'
  if (ratio < 0.9) return '3:4'
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
