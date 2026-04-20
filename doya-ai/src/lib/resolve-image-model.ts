// ========================================
// 画像生成モデル名解決ユーティリティ
// ========================================
// DOYA_BANNER_IMAGE_MODEL の "nano-banana-pro" エイリアスを
// 実際のGemini APIモデルIDに解決する共有ロジック
// nanobanner.ts の resolveNanoBananaImageModel と同等

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
 * Gemini画像生成APIを呼び出す（モデル自動解決 + フォールバック付き）
 */
export async function callGeminiImageAPI(
  apiKey: string,
  requestBody: Record<string, any>
): Promise<{ response: Response; model: string }> {
  const modelsToTry = await resolveImageModel(apiKey)
  console.log('[image-api] Models to try:', modelsToTry.join(' → '))

  let lastErr: any = null
  for (const model of modelsToTry) {
    const endpoint = `${GEMINI_API_BASE}/models/${model}:generateContent`
    console.log(`[image-api] Trying model: ${model}`)

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify(requestBody),
      })

      if (response.ok) {
        console.log(`[image-api] Success with model: ${model}`)
        return { response, model }
      }

      // 429 = レート制限 → すぐエラー返す
      if (response.status === 429) {
        throw new Error('APIの使用量制限に達しました。しばらく時間をおいてから再試行してください。')
      }

      const errText = await response.text()
      console.warn(`[image-api] Model ${model} failed (${response.status}):`, errText.slice(0, 300))
      lastErr = new Error(`画像生成に失敗しました (${response.status}): ${errText.slice(0, 200)}`)
    } catch (e: any) {
      if (e?.message?.includes('使用量制限')) throw e
      console.warn(`[image-api] Model ${model} error:`, e?.message)
      lastErr = e
    }
  }

  throw lastErr || new Error('画像生成モデルが利用できません。環境変数 DOYA_BANNER_IMAGE_MODEL を確認してください。')
}
