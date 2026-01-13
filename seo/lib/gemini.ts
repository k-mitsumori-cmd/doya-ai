const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'

// SEO用途は Gemini 2.0/1.5 系（品質要件）
// - テキスト: Gemini 2.0 Flash（高速・高品質、未対応環境では自動でフォールバック）
// - 画像(図解/サムネ): Nano Banana Pro（運用上の事故防止）
export const GEMINI_TEXT_MODEL_DEFAULT =
  process.env.SEO_GEMINI_TEXT_MODEL || process.env.SEO_GEMINI_CHAT_MODEL || 'gemini-2.0-flash'
export const GEMINI_IMAGE_MODEL_DEFAULT =
  process.env.SEO_GEMINI_IMAGE_MODEL || process.env.SEO_GEMINI_NANO_BANANA_MODEL || 'nano-banana-pro-preview'

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

function normalizeModelId(raw: string): string {
  const s = String(raw || '').trim()
  if (!s) return ''
  return s.startsWith('models/') ? s.slice('models/'.length) : s
}

function isNanoBananaFamily(modelId: string): boolean {
  const lower = normalizeModelId(modelId).toLowerCase()
  const isAlias =
    lower === 'nano-banana-pro' ||
    lower === 'nano-banana-pro-preview' ||
    lower === 'nanobanana-pro' ||
    lower === 'nano_banana_pro' ||
    lower === 'nano-banana'
  const isGemini3ImagePreview = lower === 'gemini-3-pro-image-preview'
  return lower.includes('banana') || isAlias || isGemini3ImagePreview
}

function nanoBananaModelCandidates(configured: string): string[] {
  const m = normalizeModelId(configured)
  const lower = m.toLowerCase()
  const out: string[] = []

  // 設定値そのもの
  if (m) out.push(m)

  // エイリアスの自動解決
  // NOTE: v1beta では nano-banana-pro が存在しないことがあるため、preview系へ寄せる
  if (lower === 'nano-banana-pro') {
    out.unshift('nano-banana-pro-preview')
  }

  // Nano Banana Pro系の安全なフォールバック
  // banner側でも利用している候補（generateContent対応）
  if (!out.includes('nano-banana-pro-preview')) out.push('nano-banana-pro-preview')
  if (!out.includes('gemini-3-pro-image-preview')) out.push('gemini-3-pro-image-preview')

  // 重複排除
  return Array.from(new Set(out.filter(Boolean)))
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

/**
 * JSONが途中で切れた場合に、閉じ括弧を補完して有効なJSONにする
 */
function closeIncompleteJson(input: string): string {
  let s = stripCodeFences(input).trim()

  // 開始文字を特定
  const sObj = s.indexOf('{')
  const sArr = s.indexOf('[')
  const startIdx = sObj < 0 ? sArr : sArr < 0 ? sObj : Math.min(sObj, sArr)
  if (startIdx < 0) return s

  s = s.slice(startIdx)

  // 未閉じの括弧をスタックで追跡
  const stack: string[] = []
  let inStr = false
  let esc = false

  for (let i = 0; i < s.length; i++) {
    const c = s[i]
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
    if (c === '{' || c === '[') {
      stack.push(c === '{' ? '}' : ']')
    } else if (c === '}' || c === ']') {
      if (stack.length > 0 && stack[stack.length - 1] === c) {
        stack.pop()
      }
    }
  }

  // 文字列が未閉じならダミーで閉じる
  if (inStr) {
    s += '"'
  }

  // 未完了の部分を削除（途中のキー名やカンマ等）
  // 最後が , や : で終わっていたら不完全なので削除
  s = s.replace(/,\s*$/, '')
  s = s.replace(/:\s*$/, ': null')
  // 未閉じの文字列キーを削除
  s = s.replace(/"[^"]*$/, '')
  // 再度末尾の , や : を削除
  s = s.replace(/,\s*$/, '')
  s = s.replace(/:\s*$/, ': null')

  // 末尾カンマを除去してから閉じ括弧を追加
  s = s.replace(/,\s*$/, '')

  // 未閉じの括弧を逆順に閉じる
  while (stack.length > 0) {
    s += stack.pop()
  }

  return s
}

// レート制限時のフォールバックモデル
const FALLBACK_MODELS = [
  // 安定系（利用可能なモデルのみ）
  'gemini-1.5-pro',
  'gemini-1.5-flash',
]

// レート制限(429)やサーバーエラー(5xx)時にリトライ
async function fetchWithRetry(
  endpoint: string,
  options: RequestInit,
  maxRetries = 3,
  baseDelay = 2000
): Promise<Response> {
  let lastError: Error | null = null
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(endpoint, options)
      
      // 成功または4xx(429以外)はそのまま返す
      if (res.ok || (res.status >= 400 && res.status < 500 && res.status !== 429)) {
        return res
      }
      
      // 429またはサーバーエラーはリトライ
      if (res.status === 429 || res.status >= 500) {
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000
        console.log(`[Gemini] Rate limited or server error (${res.status}), retrying in ${Math.round(delay)}ms... (attempt ${attempt + 1}/${maxRetries})`)
        await new Promise(r => setTimeout(r, delay))
        lastError = new Error(`Gemini API Error: ${res.status}`)
        continue
      }
      
      return res
    } catch (e: any) {
      lastError = e
      const delay = baseDelay * Math.pow(2, attempt)
      await new Promise(r => setTimeout(r, delay))
    }
  }
  throw lastError || new Error('Gemini API request failed after retries')
}

export async function geminiGenerateText(req: GenerateContentRequest): Promise<string> {
  const apiKey = getApiKey()
  
  // 試行するモデルのリストを作成
  const modelsToTry = [req.model, ...FALLBACK_MODELS.filter(m => m !== req.model)]
  
  for (const model of modelsToTry) {
    const endpoint = `${GEMINI_API_BASE}/models/${model}:generateContent`
    
    try {
      const res = await fetchWithRetry(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: req.parts }],
          generationConfig: {
            temperature: req.generationConfig?.temperature ?? 0.4,
            // アウトライン等長いJSON出力に対応するため大きめに設定
            maxOutputTokens: req.generationConfig?.maxOutputTokens ?? 65536,
          },
        }),
      })

      if (!res.ok) {
        const t = await res.text()
        const isNotFound = res.status === 404 || /NOT_FOUND|not found/i.test(t)
        const isRateLimited = res.status === 429 || /rate limit|RESOURCE_EXHAUSTED/i.test(t)

        // 404(モデル未提供)やレート制限の場合は次のモデルを試す
        if ((isNotFound || isRateLimited) && model !== modelsToTry[modelsToTry.length - 1]) {
          console.log(
            `[Gemini] Model ${model} failed (${res.status}${isNotFound ? ', NOT_FOUND' : ''}), trying next model...`
          )
          continue
        }
        throw new Error(`Gemini API Error: ${res.status} - ${t.substring(0, 500)}`)
      }

      const json = await res.json()
      const parts = json?.candidates?.[0]?.content?.parts
      const text = joinPartsText(parts)
      if (!text) throw new Error('Gemini が空のテキストを返しました')
      
      if (model !== req.model) {
        console.log(`[Gemini] Successfully used fallback model: ${model}`)
      }
      return text
    } catch (e: any) {
      const msg = String(e?.message || '')
      const isNotFound = /404|NOT_FOUND|not found/i.test(msg)
      const isRateLimited = /429|rate limit|RESOURCE_EXHAUSTED/i.test(msg)

      // 404(モデル未提供)やレート制限の場合は次のモデルを試す
      if ((isNotFound || isRateLimited) && model !== modelsToTry[modelsToTry.length - 1]) {
        console.log(`[Gemini] Model ${model} failed, trying next...`)
        continue
      }
      throw e
    }
  }
  
  throw new Error('All Gemini models exhausted')
}

export async function geminiGenerateJson<T>(
  req: Omit<GenerateContentRequest, 'parts'> & { prompt: string },
  schemaName = 'JSON'
): Promise<T> {
  const strictPrompt = [
    `You must output STRICT ${schemaName} only.`,
    'No markdown. No extra text. No code fences.',
    'If a field is unknown, use empty string/empty array/null as appropriate.',
    'Make sure to output COMPLETE JSON - do not truncate.',
    '',
    req.prompt,
  ].join('\n')

  const text = await geminiGenerateText({
    model: req.model,
    parts: [{ text: strictPrompt }],
    generationConfig: req.generationConfig,
  })

  // Step 1: 直接パース試行
  try {
    const primary = extractFirstJsonValue(text) ?? stripCodeFences(text)
    return JSON.parse(primary) as T
  } catch (e: any) {
    // Step 2: 基本的な修復
    try {
      const repaired = repairJsonLike(text)
      return JSON.parse(repaired) as T
    } catch (e2: any) {
      // Step 3: 途切れたJSONを閉じる試行
      try {
        const closed = closeIncompleteJson(text)
        const repairedClosed = repairJsonLike(closed)
        return JSON.parse(repairedClosed) as T
      } catch (e3: any) {
        // Step 4: 最終手段 - Gemini自身に修正させる
        try {
          const fixPrompt = [
            `You must output STRICT ${schemaName} only.`,
            'No markdown. No extra text. No code fences.',
            'Fix the following INCOMPLETE/TRUNCATED JSON-like text into valid strict JSON.',
            'Close any unclosed brackets, remove trailing commas, and ensure valid syntax.',
            'Do NOT change meaning; only fix syntax and complete the structure.',
            '',
            stripCodeFences(text).slice(0, 48000),
          ].join('\n')

          const fixedText = await geminiGenerateText({
            model: req.model,
            parts: [{ text: fixPrompt }],
            generationConfig: { temperature: 0, maxOutputTokens: 65536 },
          })
          const fixed = repairJsonLike(fixedText)
          return JSON.parse(fixed) as T
        } catch (e4: any) {
          // Step 5: 閉じ括弧補完後のGemini修正
          try {
            const closed = closeIncompleteJson(text)
            return JSON.parse(closed) as T
          } catch (e5: any) {
            throw new Error(
              `Gemini JSON parse failed: ${(e?.message || e) as string}\n---\n${stripCodeFences(text).substring(0, 1200)}`
            )
          }
        }
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
  const configured = args.model ?? GEMINI_IMAGE_MODEL_DEFAULT

  // Nano Banana Pro only（運用上の事故防止）
  if (!isNanoBananaFamily(configured)) {
    throw new Error(
      `SEO画像生成モデル（${configured}）は Nano Banana Pro 系ではありません。` +
        ` 環境変数 SEO_GEMINI_IMAGE_MODEL を 'nano-banana-pro-preview' または 'gemini-3-pro-image-preview' に設定してください。`
    )
  }

  const modelsToTry = nanoBananaModelCandidates(configured)
  let lastErr: any = null

  for (const model of modelsToTry) {
  const endpoint = `${GEMINI_API_BASE}/models/${model}:generateContent`
    try {
  const res = await fetchWithRetry(
    endpoint,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: args.prompt }] }],
        generationConfig: {
          // 画像のみ要求（TEXT混在だと画像が返らないケースがある）
          responseModalities: ['IMAGE'],
          imageConfig: {
            aspectRatio: args.aspectRatio ?? '16:9',
            imageSize: args.imageSize ?? '2K',
          },
        },
      }),
    },
    3,
    1500
  )

  if (!res.ok) {
    const t = await res.text()
        // 404/400（モデル未対応/未存在）のときは次を試す
        if ((res.status === 404 || res.status === 400) && model !== modelsToTry[modelsToTry.length - 1]) {
          lastErr = new Error(`Gemini Image API Error: ${res.status} - ${t.substring(0, 300)}`)
          continue
        }
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

      // 成功レスポンスでも画像が無い場合は次のモデルへ
      lastErr = new Error(`Gemini が画像を返しませんでした（モデル: ${model}）。`)
      if (model !== modelsToTry[modelsToTry.length - 1]) continue
      throw lastErr
    } catch (e: any) {
      lastErr = e
      if (model !== modelsToTry[modelsToTry.length - 1]) continue
      throw e
    }
  }

  throw (
    lastErr ||
    new Error(
      `Gemini 画像生成に失敗しました。SEO_GEMINI_IMAGE_MODEL を 'nano-banana-pro-preview' または 'gemini-3-pro-image-preview' に設定してください。`
    )
  )
}


