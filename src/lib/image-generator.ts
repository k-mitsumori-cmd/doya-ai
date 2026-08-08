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
import { withTimeout } from './fetch-timeout'

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

  // フォールバックは短めに（primaryで時間を使った後なので全体が長引かないように）。本文読み取りまでタイムアウトで覆う。
  const timeoutMs = Number(process.env.DOYA_FALLBACK_TIMEOUT_MS) || 45000
  return withTimeout(NANO_BANANA_PRO_PREVIEW_MODEL, timeoutMs, async (signal) => {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(body),
      signal,
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
  })
}

/**
 * gpt-image-2 が受け付けるサイズへ正規化する。
 *
 * ⚠️ 以前はどんなサイズも 1024x1024 / 1536x1024 / 1024x1536 の3つへ丸めていたが、
 *    gpt-image-2 は実際には「幅・高さが16の倍数・アスペクト比3:1以内」なら
 *    任意サイズを受け付ける（2026-08-06 実API検証）。3つに丸めると、
 *    9:16 のような比率を出したい呼び出し元が後段で切り抜く必要が生まれ、
 *    焼き込んだ文字が切れる（/adbanner で実際に起きていた）。
 *
 *    そこで有効なサイズはそのまま通し、無効なときだけ最も近い有効値へ丸める。
 *    既存の呼び出し元が渡している3プリセットは全て有効なのでそのまま通過し、
 *    挙動は変わらない。
 */
const GPT_IMAGE_MIN = 512
const GPT_IMAGE_MAX = 3840
const GPT_IMAGE_MAX_RATIO = 3

function mapSizeForGptImage2(size: string): GptImageSize {
  if (size === 'auto') return 'auto'

  const [wRaw, hRaw] = String(size).split('x').map((v) => Number(v))
  if (!Number.isFinite(wRaw) || !Number.isFinite(hRaw) || wRaw <= 0 || hRaw <= 0) return '1024x1024'

  // 16の倍数へ丸め、上下限に収める
  const clamp = (n: number) => Math.min(GPT_IMAGE_MAX, Math.max(GPT_IMAGE_MIN, Math.round(n / 16) * 16))
  let w = clamp(wRaw)
  let h = clamp(hRaw)

  // アスペクト比が 3:1 を超えると 400 で拒否される。長辺を詰めて比率を収める。
  // ⚠️ 短辺を伸ばす方向で合わせると上限3840を超えうるので、長辺側を縮める。
  if (w / h > GPT_IMAGE_MAX_RATIO) {
    w = clamp(h * GPT_IMAGE_MAX_RATIO)
  } else if (h / w > GPT_IMAGE_MAX_RATIO) {
    h = clamp(w * GPT_IMAGE_MAX_RATIO)
  }

  return `${w}x${h}` as GptImageSize
}
