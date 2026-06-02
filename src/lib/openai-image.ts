// ========================================
// OpenAI 画像生成 (gpt-image-2 / ChatGPT Images 2.0)
// ========================================
// REST API 直叩き（SDK の typing が gpt-image 系に未対応のため）
// 参考: https://developers.openai.com/api/docs/models/gpt-image-2
// メインモデルは gpt-image-2。size=1024x1024/1536x1024/1024x1536, quality=low/medium/high
// レスポンスは data[0].b64_json（gpt-image-1 と同一形状・実APIで確認済み）。
// 緊急時は環境変数 OPENAI_IMAGE_MODEL で別モデル(gpt-image-1 等)に切替可能。
// ========================================

import { withTimeout } from './fetch-timeout'

const OPENAI_IMAGE_ENDPOINT = 'https://api.openai.com/v1/images/generations'
const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-2'

export type GptImageQuality = 'low' | 'medium' | 'high' | 'auto'
export type GptImageSize = '1024x1024' | '1024x1536' | '1536x1024' | 'auto'

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

  // gpt-image-2 は quality=low/medium/high のみ（auto 非対応）。auto/未指定は high に寄せる
  const quality: Exclude<GptImageQuality, 'auto'> =
    params.quality && params.quality !== 'auto' ? params.quality : 'high'

  // gpt-image-2 の high 品質は数十秒〜90秒かかることがある。短すぎると abort→フォールバックで画質が落ちるため長め。
  // タイムアウトは本文読み取り(json/text)まで覆う（withTimeout 内で完結させる）。
  const timeoutMs = Number(process.env.DOYA_IMAGE_TIMEOUT_MS) || 120000
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
