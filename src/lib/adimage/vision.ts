// ============================================
// ドヤ広告画像AI 画像を実際に見るためのVisionヘルパー
// ============================================
// ⚠️ これを別に用意している理由:
//    共通の geminiGenerateText() は parts から text だけを取り出して送るため
//    （seo/lib/gemini.ts:joinPartsText）、inlineData で画像を渡しても**捨てられる**。
//    前身 /adbanner のフィードバックが「視認性（文字の可読性）」を採点しているのに
//    実際の画像を一度も見ていなかったのは、まさにこれが原因だった。
//    文字が崩れていても高得点が出るため、改善ループの土台が機能していなかった。
//
//    本サービスは焼き込み方式であり、出力を見ずに品質を語ることはできない。
//    そのため画像を確実に渡せる経路をここに用意する。
//
// ⚠️ これは画像「生成」ではなく画像「解析」なので、画像生成の統一ディスパッチャ
//    （generateImageWithFallback）の対象外。生成は必ずそちらを通すこと。
import { withTimeout } from '@/lib/fetch-timeout'

const ENDPOINT = 'https://api.openai.com/v1/chat/completions'
const MODEL = process.env.ADIMAGE_VISION_MODEL || 'gpt-4o'
const VISION_RESPONSE_MAX_BYTES = 1024 * 1024
const VISION_ERROR_MAX_BYTES = 64 * 1024

export interface VisionRequest {
  prompt: string
  pngBase64: string
  maxTokens?: number
}

async function callVision(req: VisionRequest): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY が設定されていません')

  return withTimeout('adimage-vision', 90000, async (signal) => {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: req.maxTokens ?? 1200,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: req.prompt },
              { type: 'image_url', image_url: { url: `data:image/png;base64,${req.pngBase64}` } },
            ],
          },
        ],
      }),
      signal,
    })
    if (!res.ok) {
      const t = await readBoundedVisionResponse(res, VISION_ERROR_MAX_BYTES).catch(() => '')
      throw new Error(`vision failed (${res.status}): ${t.slice(0, 300)}`)
    }
    const json = JSON.parse(await readBoundedVisionResponse(res, VISION_RESPONSE_MAX_BYTES))
    return String(json?.choices?.[0]?.message?.content || '')
  })
}

async function readBoundedVisionResponse(res: Response, maxBytes: number): Promise<string> {
  if (Number(res.headers.get('content-length')) > maxBytes) {
    void res.body?.cancel().catch(() => {})
    throw new Error('Vision response is too large')
  }
  if (!res.body) return ''
  const reader = res.body.getReader()
  const chunks: Buffer[] = []
  let length = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > maxBytes) throw new Error('Vision response is too large')
      chunks.push(Buffer.from(value))
    }
    return Buffer.concat(chunks, length).toString('utf8')
  } finally {
    void reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}

function stripFences(s: string): string {
  return s.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
}

/** 画像を見せてJSONで答えさせる */
export async function visionJson<T>(req: VisionRequest): Promise<T> {
  const raw = await callVision({
    ...req,
    prompt: `${req.prompt}\n\n出力はJSONのみ。前後に説明文やコードフェンスを付けないこと。`,
  })
  const text = stripFences(raw)
  try {
    return JSON.parse(text) as T
  } catch {
    // モデルが前後に文章を付けることがある。最初のJSONらしき塊を拾う
    const m = text.match(/[[{][\s\S]*[\]}]/)
    if (m) return JSON.parse(m[0]) as T
    throw new Error('画像の解析結果を読み取れませんでした')
  }
}
