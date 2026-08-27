// ========================================
// OpenAI 画像生成 (gpt-image-2 / ChatGPT Images 2.0)
// ========================================
// REST API 直叩き（SDK の typing が gpt-image 系に未対応のため）
// 参考: https://developers.openai.com/api/docs/models/gpt-image-2
// メインモデルは gpt-image-2。size は16の倍数の任意サイズ（3:1以内）, quality=low/medium/high
// レスポンスは data[0].b64_json（gpt-image-1 と同一形状・実APIで確認済み）。
// 緊急時は環境変数 OPENAI_IMAGE_MODEL で別モデル(gpt-image-1 等)に切替可能。
// ========================================

import { withTimeout } from './fetch-timeout'
import OpenAI, { toFile } from 'openai'

const OPENAI_IMAGE_ENDPOINT = 'https://api.openai.com/v1/images/generations'
const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2'

export type GptImageQuality = 'low' | 'medium' | 'high' | 'auto'
// gpt-image-2 は3プリセット固定ではなく、幅・高さが16の倍数なら任意サイズを受け付ける
// （2026-08-06 実API検証。実エラー: "Width and height must both be divisible by 16" /
//  "The maximum supported aspect ratio is 3:1"）。
// 有効値への丸めは image-generator.ts:mapSizeForGptImage2() が一元的に担う。
export type GptImageSize = `${number}x${number}` | 'auto'

export interface GptImageResult {
  b64: string
  revisedPrompt?: string
}

export async function generateImageGpt(params: {
  prompt: string
  size?: GptImageSize
  quality?: GptImageQuality
  n?: number
}): Promise<GptImageResult[]> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY が設定されていません')

  // gpt-image-2 は quality=low/medium/high のみ（auto 非対応）。auto/未指定は medium に寄せる
  // （2026-08-27 実測: high は medium の約2.8倍の時間・4.3倍の単価で、仕上がりの差は採用判断に足りなかった）
  const quality: Exclude<GptImageQuality, 'auto'> =
    params.quality && params.quality !== 'auto' ? params.quality : 'medium'

  // gpt-image-2 の 1536x1024 は並列時に実測 medium 約60秒 / high 123〜145秒。
  // 既定は medium だが high 指定の呼び出しも通せるよう、タイムアウトは high 基準のまま据え置く
  //（短すぎると abort→nano-banana に落ちて画質が下がる）。
  // ただし 200秒だと、サイト解析等の前処理(〜90秒)と合算してフロント Abort(290秒)/maxDuration(300秒)を超えうるため、
  // 通常完了する 145秒より十分余裕を持たせつつ上限を 170秒に設定（stuck時は nano-banana へ早めにフォールバック）。
  // タイムアウトは本文読み取り(json/text)まで覆う（withTimeout 内で完結）。
  const timeoutMs = Number(process.env.DOYA_IMAGE_TIMEOUT_MS) || 170000
  return withTimeout(OPENAI_IMAGE_MODEL, timeoutMs, async (signal) => {
    const res = await fetch(OPENAI_IMAGE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_IMAGE_MODEL,
        prompt: params.prompt,
        size: params.size || '1024x1024',
        quality,
        n: params.n || 1,
      }),
      signal,
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`OpenAI image generation failed (${res.status}): ${errText.slice(0, 500)}`)
    }

    const json = await res.json()
    const data = Array.isArray(json?.data) ? json.data : []
    return data.map((d: any) => ({
      b64: String(d?.b64_json || ''),
      revisedPrompt: d?.revised_prompt ? String(d.revised_prompt) : undefined,
    }))
  })
}

/** 背景の扱い。透過はロゴ・アイコンなど切り抜きが要る用途だけで指定する。 */
export type GptImageBackground = 'transparent' | 'opaque' | 'auto'

/**
 * 参照画像つきの編集。gpt-image-2 を優先し、編集未対応環境では gpt-image-1 を使う。
 *
 * ⚠️ background の既定は 'opaque'。
 *    この関数は generateImageWithFallback() から呼ばれる＝ペルソナの人物画像や
 *    インタビューのサムネイル、バナー生成まで通る共通経路のため、透過を既定にすると
 *    被写体が切り抜かれた画像が返り、カード表示やJPEG書き出しで破綻する。
 *    透過が要るのはロゴ・アイコン生成だけなので、その用途から明示的に渡すこと。
 */
export async function editImageGpt(params: {
  prompt: string
  images: Array<{ base64: string; mimeType: string }>
  size?: GptImageSize
  quality?: GptImageQuality
  background?: GptImageBackground
}): Promise<GptImageResult & { model: string }> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY が設定されていません')
  const client = new OpenAI({ apiKey })
  const uploads = await Promise.all(params.images.map((image, index) => {
    const ext = image.mimeType.includes('webp') ? 'webp' : image.mimeType.includes('jpeg') ? 'jpg' : 'png'
    return toFile(Buffer.from(image.base64, 'base64'), `reference-${index + 1}.${ext}`, { type: image.mimeType })
  }))
  const quality = params.quality && params.quality !== 'auto' ? params.quality : 'medium'
  const size = ['1024x1024', '1536x1024', '1024x1536', 'auto'].includes(params.size || '')
    ? params.size as '1024x1024' | '1536x1024' | '1024x1536' | 'auto'
    : '1024x1024'
  const background = params.background || 'opaque'
  const configured = process.env.OPENAI_IMAGE_EDIT_MODEL || OPENAI_IMAGE_MODEL
  const models = configured === 'gpt-image-1' ? ['gpt-image-1'] : [configured, 'gpt-image-1']
  let lastError: unknown
  for (const model of [...new Set(models)]) {
    try {
      const response = await client.images.edit({
        model: model as 'gpt-image-1',
        image: uploads,
        prompt: params.prompt,
        size,
        quality,
        background,
        n: 1,
      })
      const b64 = response.data?.[0]?.b64_json
      if (!b64) throw new Error(`${model} returned no image data`)
      return { b64, model }
    } catch (error) {
      lastError = error
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}
