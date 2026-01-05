// ========================================
// ドヤペルソナAI - ポートレート画像生成API
// ========================================
import { NextRequest, NextResponse } from 'next/server'

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'

type GeminiModel = {
  name?: string
  supportedGenerationMethods?: string[]
} & Record<string, any>

function normalizeModelId(model: string): string {
  const m = String(model || '').trim()
  if (!m) return ''
  return m.startsWith('models/') ? m.slice('models/'.length) : m
}

let modelsCache: { at: number; models: GeminiModel[] } | null = null
const MODELS_CACHE_TTL_MS = 10 * 60 * 1000 // 10分

async function listModels(apiKey: string): Promise<GeminiModel[]> {
  const now = Date.now()
  if (modelsCache && now - modelsCache.at < MODELS_CACHE_TTL_MS) return modelsCache.models
  const res = await fetch(`${GEMINI_API_BASE}/models`, {
    method: 'GET',
    headers: { 'x-goog-api-key': apiKey },
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`ListModels failed: ${res.status} - ${t.substring(0, 300)}`)
  }
  const json = await res.json()
  const models = Array.isArray(json?.models) ? (json.models as GeminiModel[]) : []
  modelsCache = { at: now, models }
  return models
}

function isGenerateContentSupported(m: GeminiModel): boolean {
  const methods = m?.supportedGenerationMethods
  return Array.isArray(methods) && methods.includes('generateContent')
}

async function resolvePortraitImageModel(apiKey: string, configured: string): Promise<string[]> {
  const cfg = normalizeModelId(configured)
  const lower = cfg.toLowerCase()

  // エイリアス許容
  const isAlias =
    lower === 'nano-banana-pro' ||
    lower === 'nanobanana-pro' ||
    lower === 'nano_banana_pro' ||
    lower === 'nano-banana' ||
    lower === 'nano-banana-pro-preview' ||
    lower === 'gemini-3-pro-image-preview'

  // 明示指定があるならまず試す（存在しない場合は後でフォールバック）
  const preferred: string[] = []
  if (cfg) preferred.push(cfg)

  // エイリアス/未指定なら ListModels から画像系を探す
  if (!cfg || isAlias) {
    const models = await listModels(apiKey)
    const candidates = models
      .filter((m) => isGenerateContentSupported(m))
      .map((m) => String(m?.name || ''))
      .filter(Boolean)
      .map((full) => normalizeModelId(full))

    const banana = candidates.find((n) => n.toLowerCase().includes('banana'))
    if (banana) preferred.push(banana)

    // 画像っぽい次点（環境差異対策）
    const proImage = candidates.find((n) => n.toLowerCase() === 'gemini-3-pro-image-preview')
    if (proImage) preferred.push(proImage)
  }

  // 最終フォールバック（よくある名称を順に）
  preferred.push('gemini-3-pro-image-preview')
  preferred.push('nano-banana-pro-preview')

  // 重複除去
  return Array.from(new Set(preferred.filter(Boolean)))
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { persona } = body

    if (!persona) {
      return NextResponse.json({ error: 'ペルソナ情報が必要です' }, { status: 400 })
    }

    const apiKey = process.env.GOOGLE_GENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'APIキーが設定されていません' }, { status: 500 })
    }

    // ペルソナ情報からプロンプトを構築
    const { name, age, gender, occupation, lifestyle, personalityTraits } = persona
    
    const prompt = `
Generate a professional headshot portrait photo of a Japanese person for a marketing persona profile.

REQUIREMENTS:
- Age: approximately ${age} years old
- Gender: ${gender === '男性' ? 'male' : gender === '女性' ? 'female' : gender}
- Occupation: ${occupation}
- Personality: ${Array.isArray(personalityTraits) ? personalityTraits.join(', ') : 'professional, friendly'}
- Style: Professional business headshot, clean background, good lighting
- Expression: Confident, approachable smile
- Attire: Business casual appropriate for ${occupation}
- Background: Simple, neutral color (light gray or white)

IMPORTANT:
- This is for a fictional marketing persona, not a real person
- Make the person look authentic and relatable
- High quality, professional photography style
- Face clearly visible, looking at camera
- Upper body / headshot framing
- COMPOSITION: Subject MUST be centered (no left/right offset), with balanced margins on both sides.
- CROPPING: Fill the frame; avoid large empty space. Keep head and shoulders centered.
- CAMERA: Eye-level, straight-on, minimal tilt. No extreme angles.

Output a single high-quality portrait image.
`

    const configuredModel =
      process.env.DOYA_BANNER_IMAGE_MODEL ||
      process.env.NANO_BANANA_PRO_MODEL ||
      process.env.GEMINI_IMAGE_MODEL ||
      'nano-banana-pro'

    const modelsToTry = await resolvePortraitImageModel(apiKey, configuredModel)

    let lastErrText = ''
    let lastStatus = 0
    let lastModel = ''
    let result: any = null

    for (const model of modelsToTry) {
      lastModel = model
      const endpoint = `${GEMINI_API_BASE}/models/${model}:generateContent`
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            responseModalities: ['IMAGE'],
            temperature: 0.4,
            candidateCount: 1,
          },
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
          ],
        }),
      })

      if (!response.ok) {
        lastStatus = response.status
        lastErrText = await response.text()
        console.warn(`Portrait model failed: ${model}`, response.status, lastErrText.slice(0, 200))
        continue
      }

      result = await response.json()
      break
    }

    if (!result) {
      return NextResponse.json(
        {
          error:
            `ポートレート生成に失敗しました（model=${lastModel || 'unknown'} / status=${lastStatus}）。` +
            ` モデルID（DOYA_BANNER_IMAGE_MODEL）をご確認ください。`,
          details: lastErrText?.slice?.(0, 500) || '',
        },
        { status: 500 }
      )
    }
    
    // 画像データを抽出
    const parts = result?.candidates?.[0]?.content?.parts
    if (!Array.isArray(parts)) {
      return NextResponse.json({ error: '画像データが見つかりません' }, { status: 500 })
    }

    for (const part of parts) {
      const inline = part?.inlineData || part?.inline_data
      if (inline?.data && typeof inline.data === 'string') {
        const mimeType = inline?.mimeType || 'image/png'
        return NextResponse.json({
          success: true,
          image: `data:${mimeType};base64,${inline.data}`,
        })
      }
    }

    return NextResponse.json({ error: '画像の抽出に失敗しました' }, { status: 500 })
  } catch (error) {
    console.error('Portrait generation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'ポートレート生成中にエラーが発生しました' },
      { status: 500 }
    )
  }
}

