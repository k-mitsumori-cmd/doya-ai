const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'

// SEO用途は Gemini 3 系を前提にする（必要なら環境変数で上書き）
export const GEMINI_TEXT_MODEL_DEFAULT = process.env.SEO_GEMINI_TEXT_MODEL || 'gemini-3-flash-preview'
export const GEMINI_IMAGE_MODEL_DEFAULT = process.env.SEO_GEMINI_IMAGE_MODEL || 'gemini-3-pro-image-preview'

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
  // 環境差分（Vercel/ローカル）で変数名が揺れやすいので複数候補を許容する
  const candidates = [
    process.env.GOOGLE_GENAI_API_KEY,
    process.env.GOOGLE_API_KEY,
    process.env.GEMINI_API_KEY,
    process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  ].filter((v): v is string => typeof v === 'string' && v.trim().length > 0)

  const apiKey = candidates[0]
  if (!apiKey) {
    throw new Error(
      'Gemini APIキーが設定されていません。環境変数: GOOGLE_GENAI_API_KEY（推奨）/ GOOGLE_API_KEY / GEMINI_API_KEY を設定してください。'
    )
  }
  return apiKey.trim()
}

function joinPartsText(parts: any): string {
  const p = Array.isArray(parts) ? parts : []
  return p.map((x) => (typeof x?.text === 'string' ? x.text : '')).join('\n').trim()
}

function stripCodeFences(s: string): string {
  // ```json ... ``` や ``` ... ``` を雑に除去（Geminiがルールを破ることがあるため）
  return s
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim()
}

function extractFirstJsonValue(text: string): string | null {
  const cleaned = stripCodeFences(text)
  const sObj = cleaned.indexOf('{')
  const sArr = cleaned.indexOf('[')
  const s =
    sObj < 0 ? sArr : sArr < 0 ? sObj : Math.min(sObj, sArr)
  if (s < 0) return null

  const open = cleaned[s]
  const close = open === '{' ? '}' : ']'

  // 文字列中の括弧を無視しつつ、対応する閉じ括弧までを切り出す
  let depth = 0
  let inStr = false
  let esc = false
  for (let i = s; i < cleaned.length; i++) {
    const c = cleaned[i]
    if (inStr) {
      if (esc) {
        esc = false
      } else if (c === '\\') {
        esc = true
      } else if (c === '"') {
        inStr = false
      }
      continue
    }
    if (c === '"') {
      inStr = true
      continue
    }
    if (c === open) depth++
    if (c === close) depth--
    if (depth === 0) return cleaned.slice(s, i + 1)
  }
  return null
}

function repairJsonLike(input: string): string {
  let s = stripCodeFences(input)
  // U+2028/U+2029 はJSON.parseが嫌う環境があるので除去
  s = s.replace(/\u2028|\u2029/g, '')
  // 先頭のJSON本体だけ抜く（余計な文章が混ざることがある）
  const extracted = extractFirstJsonValue(s)
  if (extracted) s = extracted
  // 末尾カンマ（..., } / ..., ]）を除去
  // NOTE: 厳密には文字列中に影響する可能性があるが、Geminiの壊れ方はほぼこれなので実用優先
  for (let i = 0; i < 5; i++) {
    const next = s.replace(/,\s*([}\]])/g, '$1')
    if (next === s) break
    s = next
  }
  return s.trim()
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

  try {
    const primary = extractFirstJsonValue(text) ?? stripCodeFences(text)
    return JSON.parse(primary) as T
  } catch (e: any) {
    // よくある壊れ方（末尾カンマ/コードフェンス混入/余計な文章）を自動修復して再トライ
    try {
      const repaired = repairJsonLike(text)
      return JSON.parse(repaired) as T
    } catch (e2: any) {
      // 最終手段: Gemini自身に「厳密JSONに整形」させる（1回だけ）
      try {
        const fixPrompt = [
          `You must output STRICT ${schemaName} only.`,
          'No markdown. No extra text. No code fences.',
          'Fix the following JSON-like text into valid strict JSON.',
          'Do NOT change meaning; only fix syntax.',
          '',
          stripCodeFences(text).slice(0, 24000),
        ].join('\n')

        const fixedText = await geminiGenerateText({
          model: req.model,
          parts: [{ text: fixPrompt }],
          generationConfig: { temperature: 0, maxOutputTokens: 4096 },
        })
        const fixed = repairJsonLike(fixedText)
        return JSON.parse(fixed) as T
      } catch (e3: any) {
        throw new Error(
          `Gemini JSON parse failed: ${(e?.message || e) as string}\n---\n${stripCodeFences(text).substring(0, 1200)}`
        )
      }
    }
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


