// ========================================
// 画像生成モデル名解決ユーティリティ
// ========================================
// メイン: gpt-image-2 (OpenAI ChatGPT Images 2.0)
// フォールバック: nano-banana-pro-preview (Google Gemini 3 系)
// 入力画像（inlineData）あり → nano-banana-pro-preview 直行
// ※ 呼び出し元との互換のため、戻り値は Response オブジェクト（Gemini 形式 JSON）

import { generateImageWithFallback } from './image-generator'

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'

type GeminiModel = {
  name?: string
  supportedGenerationMethods?: string[]
} & Record<string, any>

let modelsCache: { at: number; models: GeminiModel[] } | null = null
const MODELS_CACHE_TTL_MS = 10 * 60 * 1000 // 10分

function normalizeModelId(model: string): string {
  const m = String(model || '').trim()
  if (!m) return ''
  return m.startsWith('models/') ? m.slice('models/'.length) : m
}

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

const KNOWN_ALIASES = ['nano-banana-pro', 'nanobanana-pro', 'nano_banana_pro', 'nano-banana']

// nanobanner.ts と同じフォールバック候補
const FALLBACK_MODELS = [
  'nano-banana-pro-preview',
  'gemini-3-pro-image-preview',
  'gemini-2.0-flash-preview-image-generation',
]

/**
 * 画像生成モデル名を解決する
 * "nano-banana-pro" などのエイリアスを実際のGemini APIモデルIDに変換
 *
 * @returns 解決済みモデルIDのリスト（フォールバック順）
 */
export async function resolveImageModel(apiKey: string): Promise<string[]> {
  const configured = normalizeModelId(
    process.env.DOYA_BANNER_IMAGE_MODEL ||
    process.env.NANO_BANANA_PRO_MODEL ||
    process.env.GEMINI_IMAGE_MODEL ||
    'nano-banana-pro'
  )
  const lower = configured.toLowerCase()
  const isAlias = KNOWN_ALIASES.includes(lower)

  // エイリアスでなければそのまま返す（+ フォールバック付き）
  if (!isAlias) {
    return [configured, ...FALLBACK_MODELS].filter((v, i, a) => a.indexOf(v) === i)
  }

  // ListModels APIから実モデルを検索
  try {
    const models = await listModels(apiKey)
    const candidates = models
      .filter((m) => isGenerateContentSupported(m))
      .map((m) => normalizeModelId(String(m?.name || '')))
      .filter(Boolean)

    console.log('[resolve-image-model] Available generateContent models:', candidates.slice(0, 20).join(', '))

    // "banana" を含むモデルを最優先
    const banana = candidates.find((n) => n.toLowerCase().includes('banana'))
    if (banana) {
      return [banana, ...FALLBACK_MODELS].filter((v, i, a) => a.indexOf(v) === i)
    }

    // 次点: "image" を含む Gemini 3 系モデル
    const gemini3Image = candidates.find((n) => {
      const l = n.toLowerCase()
      return l.includes('image') && (l.includes('gemini-3') || l.includes('gemini3'))
    })
    if (gemini3Image) {
      return [gemini3Image, ...FALLBACK_MODELS].filter((v, i, a) => a.indexOf(v) === i)
    }

    // 次点: "image" を含む任意のモデル
    const imagey = candidates.find((n) => n.toLowerCase().includes('image'))
    if (imagey) {
      return [imagey, ...FALLBACK_MODELS].filter((v, i, a) => a.indexOf(v) === i)
    }
  } catch (e) {
    console.warn('[resolve-image-model] ListModels failed, using fallback:', e)
  }

  // ListModels失敗時のフォールバック
  return [...FALLBACK_MODELS]
}

/**
 * 画像生成 API を呼び出す（メイン: gpt-image-2 / フォールバック: nano-banana-pro-preview）
 *
 * 互換: 呼び出し元4ファイル（persona/portrait, persona/scene, persona/banner,
 * interview/projects/[id]/thumbnail）が `response.json()` で Gemini 形式を期待するため、
 * 結果を Gemini 形式の JSON でラップした Response を返す。
 *
 * @param _apiKey 旧 Gemini API キー（互換目的、内部では未使用 — image-generator が環境変数から取得）
 * @param requestBody Gemini 形式の generateContent リクエストボディ
 */
export async function callGeminiImageAPI(
  _apiKey: string,
  requestBody: Record<string, any>
): Promise<{ response: Response; model: string }> {
  // requestBody から prompt と入力画像を抽出
  const contents = (requestBody as any)?.contents
  const rawParts = Array.isArray(contents) && contents[0]?.parts
  const parts: any[] = Array.isArray(rawParts) ? rawParts : []

  let prompt = ''
  const inputImages: Array<{ mimeType: string; base64: string }> = []
  for (const p of parts) {
    if (typeof p?.text === 'string' && p.text.trim()) {
      prompt += (prompt ? '\n' : '') + p.text
    }
    const inline = p?.inlineData || p?.inline_data
    if (inline?.data && typeof inline.data === 'string') {
      inputImages.push({
        mimeType: inline.mimeType || inline.mime_type || 'image/png',
        base64: inline.data,
      })
    }
  }

  if (!prompt) {
    throw new Error('画像生成: prompt が空です')
  }

  console.log(
    `[image-api] dispatching (inputImages=${inputImages.length})` +
      ` → primary: gpt-image-2, fallback: nano-banana-pro-preview`
  )

  const result = await generateImageWithFallback({
    prompt,
    size: '1024x1024',
    quality: 'medium',
    inputImages,
    responseModalities: (requestBody as any)?.generationConfig?.responseModalities,
    temperature: (requestBody as any)?.generationConfig?.temperature,
    safetySettings: (requestBody as any)?.safetySettings,
  })

  console.log(
    `[image-api] success with ${result.model}` +
      (result.fallbackUsed ? ' (フォールバック発動)' : '')
  )

  // 呼び出し元互換: Gemini 形式 (candidates[0].content.parts[*].inlineData.data) でラップ
  const wrappedJson = {
    candidates: [
      {
        content: {
          parts: [
            {
              inlineData: {
                mimeType: result.mimeType,
                data: result.base64,
              },
            },
          ],
        },
      },
    ],
  }

  const response = new Response(JSON.stringify(wrappedJson), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

  return { response, model: result.model }
}
