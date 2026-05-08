// ========================================
// OpenAI 画像生成 (gpt-image-1 / image 2.0)
// ========================================
// REST API 直叩き（SDK v4.24.1 は gpt-image-1 用 typing が無いため）
// 参考: https://platform.openai.com/docs/api-reference/images/create
// ========================================

const OPENAI_IMAGE_ENDPOINT = 'https://api.openai.com/v1/images/generations'

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

  const res = await fetch(OPENAI_IMAGE_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-image-1',
      prompt: params.prompt,
      size: params.size || '1024x1024',
      quality: params.quality || 'high',
      n: params.n || 1,
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(
      `OpenAI image generation failed (${res.status}): ${errText.slice(0, 500)}`
    )
  }

  const json = await res.json()
  const data = Array.isArray(json?.data) ? json.data : []
  return data.map((d: any) => ({
    b64: String(d?.b64_json || ''),
    revisedPrompt: d?.revised_prompt ? String(d.revised_prompt) : undefined,
  }))
}
