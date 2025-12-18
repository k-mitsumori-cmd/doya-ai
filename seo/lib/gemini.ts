const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'

export const GEMINI_TEXT_MODEL_DEFAULT = 'gemini-3-flash-preview'
export const GEMINI_IMAGE_MODEL_DEFAULT = 'gemini-3-pro-image-preview'

type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } }

interface GenerateContentRequest {
  model: string
  parts: GeminiPart[]
  generationConfig?: {
    temperature?: number
    maxOutputTokens?: number
    responseModalities?: Array<'TEXT' | 'IMAGE'>
    imageConfig?: {
      aspectRatio?: string
      imageSize?: string
    }
  }
}

function getApiKey(): string {
  const apiKey = process.env.GOOGLE_GENAI_API_KEY
  if (!apiKey) throw new Error('GOOGLE_GENAI_API_KEY が設定されていません')
  return apiKey
}

function joinPartsText(parts: any): string {
  const p = Array.isArray(parts) ? parts : []
  return p.map((x) => (typeof x?.text === 'string' ? x.text : '')).join('\n').trim()
}

function extractFirstJsonObject(text: string): string | null {
  const s = text.indexOf('{')
  if (s < 0) return null
  // 雑に最初のJSONオブジェクト終端を探す（出力は「JSON only」を強制する前提）
  let depth = 0
  for (let i = s; i < text.length; i++) {
    const c = text[i]
    if (c === '{') depth++
    if (c === '}') depth--
    if (depth === 0) return text.slice(s, i + 1)
  }
  return null
}

export async function geminiGenerateText(req: GenerateContentRequest): Promise<string> {
  const apiKey = getApiKey()
  const endpoint = `${GEMINI_API_BASE}/models/${req.model}:generateContent`

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [{ parts: req.parts }],
      generationConfig: {
        temperature: req.generationConfig?.temperature ?? 0.4,
        maxOutputTokens: req.generationConfig?.maxOutputTokens ?? 4096,
      },
    }),
  })

  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Gemini API Error: ${res.status} - ${t.substring(0, 500)}`)
  }

  const json = await res.json()
  const parts = json?.candidates?.[0]?.content?.parts
  const text = joinPartsText(parts)
  if (!text) throw new Error('Gemini が空のテキストを返しました')
  return text
}

export async function geminiGenerateJson<T>(
  req: Omit<GenerateContentRequest, 'parts'> & { prompt: string },
  schemaName = 'JSON'
): Promise<T> {
  const strictPrompt = [
    `You must output STRICT ${schemaName} only.`,
    'No markdown. No extra text. No code fences.',
    'If a field is unknown, use empty string/empty array/null as appropriate.',
    '',
    req.prompt,
  ].join('\n')

  const text = await geminiGenerateText({
    model: req.model,
    parts: [{ text: strictPrompt }],
    generationConfig: req.generationConfig,
  })

  const maybeJson = extractFirstJsonObject(text) ?? text
  try {
    return JSON.parse(maybeJson) as T
  } catch (e: any) {
    throw new Error(`Gemini JSON parse failed: ${(e?.message || e) as string}\n---\n${text.substring(0, 800)}`)
  }
}

export async function geminiGenerateImagePng(args: {
  prompt: string
  aspectRatio?: string
  imageSize?: '2K' | '4K'
  model?: string
}): Promise<{ mimeType: string; dataBase64: string }> {
  const apiKey = getApiKey()
  const model = args.model ?? GEMINI_IMAGE_MODEL_DEFAULT
  const endpoint = `${GEMINI_API_BASE}/models/${model}:generateContent`

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: args.prompt }] }],
      generationConfig: {
        responseModalities: ['IMAGE', 'TEXT'],
        imageConfig: {
          aspectRatio: args.aspectRatio ?? '16:9',
          imageSize: args.imageSize ?? '2K',
        },
      },
    }),
  })

  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Gemini Image API Error: ${res.status} - ${t.substring(0, 500)}`)
  }

  const json = await res.json()
  const parts = json?.candidates?.[0]?.content?.parts
  if (Array.isArray(parts)) {
    for (const part of parts) {
      if (part?.inlineData?.data) {
        return {
          mimeType: part?.inlineData?.mimeType || 'image/png',
          dataBase64: part.inlineData.data as string,
        }
      }
    }
  }
  throw new Error('Gemini が画像を返しませんでした（テキストのみの応答）')
}


