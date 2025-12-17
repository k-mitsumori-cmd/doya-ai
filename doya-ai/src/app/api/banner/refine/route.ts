import { NextRequest, NextResponse } from 'next/server'

// ========================================
// バナー修正API
// ========================================
// POST /api/banner/refine
// 生成済みバナーに対してテキスト指示で修正を行う

const GEMINI_API_KEY = process.env.GOOGLE_GENAI_API_KEY
// 画像修正にはGemini 2.0 Flash Exp Image Generationを使用
// （Imagen 3は画像入力に対応していないため）
const API_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent'

interface RefineRequest {
  originalImage: string  // Base64画像 or URL
  instruction: string    // 修正指示
  category?: string
  size?: string
}

interface RefineResponse {
  success: boolean
  refinedImage?: string
  error?: string
}

export async function POST(request: NextRequest): Promise<NextResponse<RefineResponse>> {
  try {
    const body: RefineRequest = await request.json()
    const { originalImage, instruction, category, size } = body

    if (!originalImage) {
      return NextResponse.json({
        success: false,
        error: '元画像が必要です',
      }, { status: 400 })
    }

    if (!instruction || instruction.trim().length < 3) {
      return NextResponse.json({
        success: false,
        error: '修正指示を入力してください（3文字以上）',
      }, { status: 400 })
    }

    // APIキーチェック
    if (!GEMINI_API_KEY) {
      console.warn('GOOGLE_GENAI_API_KEY not set, returning mock data')
      // モック: 元画像をそのまま返す
      return NextResponse.json({
        success: true,
        refinedImage: originalImage,
      })
    }

    // プロンプト生成
    const prompt = createRefinePrompt(instruction, category, size)

    // 画像データを準備
    let imageData: { inlineData: { mimeType: string; data: string } } | null = null
    
    if (originalImage.startsWith('data:')) {
      // Base64形式の場合
      const matches = originalImage.match(/^data:(.+);base64,(.+)$/)
      if (matches) {
        imageData = {
          inlineData: {
            mimeType: matches[1],
            data: matches[2],
          },
        }
      }
    } else if (originalImage.startsWith('http')) {
      // URL形式の場合は画像をダウンロードしてBase64に変換
      try {
        const imageResponse = await fetch(originalImage)
        const arrayBuffer = await imageResponse.arrayBuffer()
        const base64 = Buffer.from(arrayBuffer).toString('base64')
        const contentType = imageResponse.headers.get('content-type') || 'image/png'
        imageData = {
          inlineData: {
            mimeType: contentType,
            data: base64,
          },
        }
      } catch (fetchError) {
        console.error('Failed to fetch original image:', fetchError)
        return NextResponse.json({
          success: false,
          error: '元画像の取得に失敗しました',
        }, { status: 400 })
      }
    }

    if (!imageData) {
      return NextResponse.json({
        success: false,
        error: '画像形式が不正です',
      }, { status: 400 })
    }

    // Gemini API呼び出し
    const apiUrl = `${API_ENDPOINT}?key=${GEMINI_API_KEY}`
    
    const requestBody = {
      contents: [
        {
          parts: [
            imageData,
            { text: prompt },
          ],
        },
      ],
      generationConfig: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
      ],
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Gemini API error:', response.status, errorText)
      throw new Error(`API Error: ${response.status}`)
    }

    const data = await response.json()

    // 画像を抽出
    const candidates = data.candidates || []
    if (candidates.length === 0) {
      throw new Error('No candidates returned')
    }

    const parts = candidates[0].content?.parts || []
    const imagePart = parts.find((p: any) => p.inlineData?.mimeType?.startsWith('image/'))

    if (!imagePart?.inlineData) {
      throw new Error('No image in response')
    }

    const refinedImage = `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`

    return NextResponse.json({
      success: true,
      refinedImage,
    })

  } catch (error: any) {
    console.error('Banner refine error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'バナーの修正に失敗しました',
    }, { status: 500 })
  }
}

function createRefinePrompt(instruction: string, category?: string, size?: string): string {
  // 指示にテキスト変更が含まれているかチェック
  const hasTextInstruction = /テキスト|文字|文言|タイトル|キャッチ|コピー|text|title/i.test(instruction)
  
  return `You are an expert advertising banner designer. Edit this banner according to the instruction.

**EDIT INSTRUCTION:** ${instruction}

${category ? `**INDUSTRY:** ${category}` : ''}
${size ? `**TARGET SIZE:** ${size}` : ''}

=== ⚠️⚠️⚠️ CRITICAL: TEXT HANDLING RULES ⚠️⚠️⚠️ ===

${hasTextInstruction ? `
**TEXT CHANGE REQUESTED - SPECIAL HANDLING:**

Since text changes are requested, follow these rules:

1. **DO NOT render Japanese text directly**
2. Instead, create a **SOLID COLOR TEXT PLACEHOLDER AREA**
   - Clean rectangular area with solid background
   - High contrast from surrounding design
   - Clearly designated space for text overlay

3. **FOR ANY EXISTING TEXT:**
   - Remove it or replace with solid color block
   - The text will be added in post-production

4. **DESIGN IMPROVEMENTS:**
   - Improve colors, layout, visual elements as requested
   - Keep the placeholder area visible and clean
` : `
**DESIGN-ONLY EDIT:**

Make the requested design changes but:

1. **DO NOT modify, add, or remove any text**
2. If existing text is corrupted/unclear:
   - Replace text area with solid color block
   - This creates space for proper text overlay

3. **FOCUS ON:**
   - Colors, gradients, backgrounds
   - Visual elements and composition
   - Overall aesthetic improvements
`}

=== GENERAL RULES ===
- Maintain professional advertisement quality
- Keep the overall theme and purpose
- Improve visual appeal and impact
- Ensure clean, modern design

Apply the edit now.`
}

