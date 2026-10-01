// ========================================
// 画像生成モデル名解決ユーティリティ
// ========================================
// メイン: gpt-image-2 (OpenAI ChatGPT Images 2.0)
// フォールバック: Nano Banana Pro (Gemini 3 Pro Image)
// 入力画像（inlineData）あり → Nano Banana Pro 直行
// ※ 呼び出し元との互換のため、戻り値は Response オブジェクト（Gemini 形式 JSON）

import { generateImageWithFallback } from './image-generator'

const PRO_IMAGE_MODEL = 'gemini-3-pro-image'
const PRO_IMAGE_PREVIEW_MODEL = 'gemini-3-pro-image-preview'
const PRO_ALIASES = new Set(['nano-banana-pro', 'nanobanana-pro', 'nano_banana_pro', 'nano-banana-pro-preview'])

function normalizeModelId(model: string): string {
  const m = String(model || '').trim()
  if (!m) return ''
  return m.startsWith('models/') ? m.slice('models/'.length) : m
}

/**
 * 画像生成モデル名を解決する
 * Pro のエイリアスだけを公式の Gemini 3 Pro Image モデルIDへ変換する。
 *
 * @returns Nano Banana Pro に限定されたモデルIDのリスト
 */
export async function resolveImageModel(_apiKey: string): Promise<string[]> {
  const configured = normalizeModelId(
    process.env.DOYA_BANNER_IMAGE_MODEL ||
    process.env.NANO_BANANA_PRO_MODEL ||
    process.env.GEMINI_IMAGE_MODEL ||
    'nano-banana-pro'
  ).toLowerCase()
  if (PRO_ALIASES.has(configured) || configured === PRO_IMAGE_MODEL) return [PRO_IMAGE_MODEL]
  if (configured === PRO_IMAGE_PREVIEW_MODEL) return [PRO_IMAGE_PREVIEW_MODEL, PRO_IMAGE_MODEL]
  throw new Error(`画像生成モデル（${configured}）は Nano Banana Pro ではありません。`)
}

/**
 * 画像生成 API を呼び出す（メイン: gpt-image-2 / フォールバック: gemini-3-pro-image）
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
  requestBody: Record<string, any>,
  timeouts: { primaryTimeoutMs?: number; fallbackTimeoutMs?: number; size?: string } = {}
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
      ` → primary: gpt-image-2, fallback: gemini-3-pro-image`
  )

  const result = await generateImageWithFallback({
    ...timeouts,
    prompt,
    size: timeouts.size || '1024x1024',
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
