// ========================================
// 画像生成 統一ディスパッチャ
// ========================================
// メイン: gpt-image-2 (OpenAI ChatGPT Images 2.0)
// フォールバック: nano-banana-pro-preview (Google Gemini 3 系)
//
// 入力画像（人物/ロゴ/参照）あり → gpt-image-2 をスキップして
//   直接 nano-banana-pro-preview を使用
//   理由: gpt-image-2 generations は入力画像非対応、edits 経由は別実装
//
// フォールバック発動条件:
//   - HTTP 4xx (429含む) / 5xx
//   - タイムアウト
//   - レスポンスに画像が含まれない
// ========================================

import { generateImageGpt, GptImageQuality, GptImageSize } from './openai-image'

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const NANO_BANANA_PRO_PREVIEW_MODEL = 'nano-banana-pro-preview'

export interface ImageInput {
  mimeType: string
  base64: string
}

export interface ImageGenRequest {
  prompt: string
  size: string
  quality?: GptImageQuality
  inputImages?: ImageInput[]
  // 以下は Nano Banana Pro Preview 経路でのみ使用
  responseModalities?: string[]
  temperature?: number
  safetySettings?: Array<{ category: string; threshold: string }>
}

export interface ImageGenResult {
  base64: string
  mimeType: string
  model: string
  fallbackUsed: boolean
  primaryError?: string
}

const DEFAULT_SAFETY_SETTINGS = [
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
]

export async function generateImageWithFallback(
  req: ImageGenRequest
): Promise<ImageGenResult> {
  const hasInputImages = !!(req.inputImages && req.inputImages.length > 0)

  if (!hasInputImages) {
    try {
      const r = await callOpenAI(req)
      return { ...r, fallbackUsed: false }
    } catch (e: any) {
      const msg = e?.message || String(e)
      console.warn(
        `[image-gen] gpt-image-2 失敗 → nano-banana-pro-preview にフォールバック: ${msg.slice(0, 200)}`
      )
      const r = await callNanoBananaProPreview(req)
      return { ...r, fallbackUsed: true, primaryError: msg }
    }
  }

  console.log('[image-gen] 入力画像あり → nano-banana-pro-preview を直接使用')
  const r = await callNanoBananaProPreview(req)
  return { ...r, fallbackUsed: false }
}

async function callOpenAI(
  req: ImageGenRequest
): Promise<Omit<ImageGenResult, 'fallbackUsed' | 'primaryError'>> {
  const size = mapSizeForGptImage2(req.size)
  const quality: GptImageQuality = req.quality || 'medium'

  const results = await generateImageGpt({
    prompt: req.prompt,
    size,
    quality,
    n: 1,
  })

  const first = results[0]
  if (!first?.b64) {
    throw new Error('gpt-image-2 returned no image data')
  }

  return {
    base64: first.b64,
    mimeType: 'image/png',
    model: 'gpt-image-2',
  }
}

async function callNanoBananaProPreview(
  req: ImageGenRequest
): Promise<Omit<ImageGenResult, 'fallbackUsed' | 'primaryError'>> {
  const apiKey =
    process.env.GOOGLE_GENAI_API_KEY ||
    process.env.GOOGLE_AI_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.NANOBANNER_API_KEY

  if (!apiKey) {
    throw new Error('GOOGLE_GENAI_API_KEY (Gemini API key) が設定されていません')
  }

  const endpoint = `${GEMINI_API_BASE}/models/${NANO_BANANA_PRO_PREVIEW_MODEL}:generateContent`

  const parts: any[] = []
  for (const img of req.inputImages || []) {
    parts.push({ inlineData: { mimeType: img.mimeType, data: img.base64 } })
  }
  parts.push({ text: req.prompt })

  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      responseModalities: req.responseModalities || ['IMAGE'],
      temperature: typeof req.temperature === 'number' ? req.temperature : 0.4,
      candidateCount: 1,
    },
    safetySettings: req.safetySettings || DEFAULT_SAFETY_SETTINGS,
  }

  // ハング対策: タイムアウトで本文読み取りまで覆う（ヘッダ受信後に本文がストールしても中断される）
  const controller = new AbortController()
  // フォールバックは短めに（primaryで時間を使った後なので全体が長引かないように）
  const timeoutMs = Number(process.env.DOYA_FALLBACK_TIMEOUT_MS) || 45000
  const to = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`nano-banana-pro-preview failed (${res.status}): ${errText.slice(0, 300)}`)
    }

    const json = await res.json()
    const candidates = Array.isArray(json?.candidates) ? json.candidates : []
    for (const c of candidates) {
      const cParts = c?.content?.parts
      if (!Array.isArray(cParts)) continue
      for (const p of cParts) {
        const inline = (p as any)?.inlineData || (p as any)?.inline_data
        if (inline?.data && typeof inline.data === 'string') {
          return {
            base64: inline.data,
            mimeType: inline.mimeType || inline.mime_type || 'image/png',
            model: NANO_BANANA_PRO_PREVIEW_MODEL,
          }
        }
      }
    }

    throw new Error('nano-banana-pro-preview returned no image data')
  } catch (e: any) {
    if (e?.name === 'AbortError') throw new Error(`nano-banana-pro-preview timeout (${timeoutMs}ms)`)
    throw e
  } finally {
    clearTimeout(to)
  }
}

function mapSizeForGptImage2(size: string): GptImageSize {
  const presets: GptImageSize[] = ['1024x1024', '1024x1536', '1536x1024', 'auto']
  if ((presets as string[]).includes(size)) return size as GptImageSize

  const [wRaw, hRaw] = String(size).split('x').map((v) => Number(v))
  if (!wRaw || !hRaw) return '1024x1024'

  const ratio = wRaw / hRaw
  if (ratio >= 1.4) return '1536x1024'
  if (ratio <= 0.7) return '1024x1536'
  return '1024x1024'
}
