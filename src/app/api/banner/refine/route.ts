import { NextRequest, NextResponse } from 'next/server'

// ========================================
// バナー修正API
// ========================================
// POST /api/banner/refine
// 修正指示に基づいて「元画像 + 指示」で画像を修正（再生成）
// Nano Banana Pro（Gemini 3 Pro Image）+ Google AI Studio APIキー
// 参考: https://ai.google.dev/gemini-api/docs/image-generation?hl=ja

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const NANO_BANANA_PRO_MODEL = 'gemini-3-pro-image-preview'

interface RefineRequest {
  originalImage: string
  instruction: string
  category?: string
  size?: string
}

interface RefineResponse {
  success: boolean
  refinedImage?: string
  error?: string
  message?: string
}

function getApiKey(): string {
  const apiKey = process.env.GOOGLE_GENAI_API_KEY
  if (!apiKey) throw new Error('GOOGLE_GENAI_API_KEY が設定されていません')
  return apiKey
}

function parseDataUrl(dataUrl: string): { mimeType: string; data: string } {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!m) throw new Error('originalImage の形式が不正です（data URLを期待）')
  return { mimeType: m[1], data: m[2] }
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

export async function POST(request: NextRequest): Promise<NextResponse<RefineResponse>> {
  try {
    const body: RefineRequest = await request.json()
    const { originalImage, instruction, category, size } = body

    if (!instruction || instruction.trim().length < 3) {
      return NextResponse.json({
        success: false,
        error: '修正指示を入力してください（3文字以上）',
      }, { status: 400 })
    }

    if (!originalImage || typeof originalImage !== 'string') {
      return NextResponse.json({
        success: false,
        error: '元画像が見つかりません。生成結果から選択してください。',
      }, { status: 400 })
    }

    const aspectRatio = getAspectRatio(size)
    const apiKey = getApiKey()
    const img = parseDataUrl(originalImage)

    const prompt = createEditPrompt(instruction, category, size)
    const endpoint = `${GEMINI_API_BASE}/models/${NANO_BANANA_PRO_MODEL}:generateContent`

    const requestBody: any = {
      contents: [
        {
          parts: [
            { inlineData: { mimeType: img.mimeType, data: img.data } },
            { text: prompt },
          ],
        },
      ],
      generationConfig: {
        responseModalities: ['IMAGE', 'TEXT'],
        imageConfig: {
          aspectRatio,
          imageSize: '2K',
        },
      },
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
      console.error('Nano Banana Pro refine error:', response.status, errorText)
      throw new Error(`API Error: ${response.status} - ${errorText.substring(0, 300)}`)
    }

    const data = await response.json()

    const parts = data?.candidates?.[0]?.content?.parts
    const imgPart = Array.isArray(parts) ? parts.find((p: any) => p?.inlineData?.data) : null
    if (!imgPart?.inlineData?.data) throw new Error('画像が生成されませんでした')
    const mimeType = imgPart.inlineData.mimeType || 'image/png'
    const refinedImage = `data:${mimeType};base64,${imgPart.inlineData.data}`

    return NextResponse.json({
      success: true,
      refinedImage,
      message: 'Nano Banana Pro で画像を修正しました',
    })

  } catch (error: any) {
    console.error('Banner refine error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'バナーの再生成に失敗しました',
    }, { status: 500 })
  }
}

function createEditPrompt(instruction: string, category?: string, size?: string): string {
  return `Edit the provided Japanese marketing banner image.

USER INSTRUCTION:
${instruction}

${category ? `INDUSTRY: ${category}` : ''}
${size ? `TARGET SIZE: ${size}` : ''}

IMPORTANT RULES:
- Keep the overall layout unless the instruction explicitly asks to change it.
- Do NOT add ANY logos, emblems, seals, badges, watermarks, or random brand marks.
- Do NOT invent a company logo.
- Prefer leaving a clean solid area for text overlay instead of rendering lots of text.
- Output ONE refined image.
`
}
