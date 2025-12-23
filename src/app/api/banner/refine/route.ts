import { NextRequest, NextResponse } from 'next/server'

// ========================================
// バナー修正API
// ========================================
// POST /api/banner/refine
// 修正指示に基づいて「元画像 + 指示」で画像を修正（再生成）
// Nano Banana Pro（Gemini 2.0 Flash Experimental）+ Google AI Studio APIキー
// 参考: https://ai.google.dev/gemini-api/docs/image-generation?hl=ja

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'
function getNanoBananaImageModel(): string {
  // Nano Banana Pro ONLY（Gemini 3）
  return (
    process.env.DOYA_BANNER_IMAGE_MODEL ||
    process.env.NANO_BANANA_PRO_MODEL ||
    process.env.GEMINI_IMAGE_MODEL ||
    'gemini-3-pro-image-preview'
  )
}

function getImageFallbackModel(): string {
  // Nano Banana Pro の範囲内でフォールバック
  return process.env.DOYA_BANNER_IMAGE_FALLBACK_MODEL || 'nano-banana-pro-preview'
}

// 最終フォールバックも Gemini 3 系のみ（Gemini 2.0 は禁止）
const LAST_RESORT_IMAGE_MODEL = 'gemini-3-flash-preview'

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
  const apiKey = 
    process.env.GOOGLE_GENAI_API_KEY || 
    process.env.GOOGLE_AI_API_KEY || 
    process.env.GEMINI_API_KEY ||
    process.env.NANOBANNER_API_KEY

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
    const preferred = getNanoBananaImageModel()
    const modelsToTry = Array.from(new Set([preferred, getImageFallbackModel(), LAST_RESORT_IMAGE_MODEL]))
    let lastError: any = null

    for (const model of modelsToTry) {
      try {
        const endpoint = `${GEMINI_API_BASE}/models/${model}:generateContent`

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
          message: `Nano Banana Pro で画像を修正しました（model: ${model}${model === preferred ? '' : ' / fallback'}）`,
        })
      } catch (e: any) {
        lastError = e
        continue
      }
    }

    throw lastError || new Error('バナーの再生成に失敗しました')

  } catch (error: any) {
    console.error('Banner refine error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'バナーの再生成に失敗しました',
    }, { status: 500 })
  }
}

function createEditPrompt(instruction: string, category?: string, size?: string): string {
  // サイズ情報から余白なし指定を作成
  const [w, h] = (size || '').split('x').map(Number)
  const sizeNote = w && h ? `Output dimensions: EXACTLY ${w}x${h} px. NO padding, NO letterboxing, NO borders.` : ''
  return `Edit the provided Japanese marketing banner image.

USER INSTRUCTION:
${instruction}

${category ? `INDUSTRY: ${category}` : ''}
${sizeNote}

=== DESIGN RULES ===
- STYLE: High-CTR Japanese paid-ad creative (SNS, Display, Landing page).
- LAYOUT: Keep text intact and readable. Update layout ONLY if user explicitly requests.
- TEXT: If user asks to change text, render the NEW Japanese text clearly with legible font, solid/gradient panel for contrast, and NO pseudo-characters.
- NO DUPLICATION: Do NOT repeat the same phrase. Never place identical text twice (e.g., no duplicated catchphrase/CTA).
- DIMENSIONS: Fill the ENTIRE canvas edge-to-edge. **ZERO** white-space or margin.
- NO logos, emblems, seals, watermarks, or invented brand marks unless user explicitly provides or requests.
- If user asks to add/remove elements, do so while maintaining visual hierarchy and text readability.
- Output ONE refined image (PNG).
`
}
