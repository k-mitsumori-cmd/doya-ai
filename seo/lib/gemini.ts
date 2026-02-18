const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta'

// Claude API用のヘルパー関数
async function generateTextWithClaude(prompt: string, options?: { temperature?: number; maxTokens?: number }): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY環境変数が設定されていません。Claude APIを使用するにはANTHROPIC_API_KEYが必要です。')
  }

  // Haiku 4.5はSonnet 4.5の1/3のコストで十分な品質。SEO記事生成に最適。
  // SEO_CLAUDE_MODEL で上書き可能（例: claude-sonnet-4-5-20250929, claude-opus-4-6）
  const model = process.env.SEO_CLAUDE_MODEL || 'claude-haiku-4-5-20251001'

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: options?.maxTokens ?? 64000,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      system: 'あなたはプロフェッショナルなコンテンツ作成アシスタントです。日本語で高品質なコンテンツを生成してください。',
      temperature: options?.temperature ?? 0.4,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Claude API Error: ${response.status} - ${errorText.substring(0, 500)}`)
  }

  const json = await response.json()
  const content = json?.content
  if (Array.isArray(content)) {
    return content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('')
  }
  return ''
}

// OpenAI API用のヘルパー関数
async function generateTextWithChatGPT(prompt: string, options?: { temperature?: number; maxTokens?: number }): Promise<string> {
  const openaiApiKey = process.env.OPENAI_API_KEY
  if (!openaiApiKey) {
    throw new Error('OPENAI_API_KEY環境変数が設定されていません。ChatGPTフォールバックを使用するにはOPENAI_API_KEYが必要です。')
  }

  const model = process.env.CHATGPT_FALLBACK_MODEL || 'gpt-4o'

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiApiKey}`,
    },
    body: JSON.stringify({
      model: model,
      messages: [
        {
          role: 'system',
          content: 'あなたはプロフェッショナルなコンテンツ作成アシスタントです。日本語で高品質なコンテンツを生成してください。',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: options?.temperature ?? 0.4,
      max_tokens: options?.maxTokens ?? 16384,
      // GPT-4oは最大16384トークン出力。それ以上はgpt-4o-2024-11-20等が必要
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenAI API Error: ${response.status} - ${errorText.substring(0, 500)}`)
  }

  const json = await response.json()
  return json.choices?.[0]?.message?.content || ''
}

// 外部LLMフォールバック（Claude → ChatGPT の順で試行）
async function generateTextWithExternalLLM(prompt: string, options?: { temperature?: number; maxTokens?: number }): Promise<string> {
  // Claude APIが設定されていれば優先
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const result = await generateTextWithClaude(prompt, options)
      if (result) {
        console.log('[LLM] Successfully used Claude API')
        return result
      }
    } catch (e: any) {
      console.warn('[LLM] Claude API failed:', e?.message?.substring(0, 200))
    }
  }

  // ChatGPTにフォールバック
  if (process.env.OPENAI_API_KEY) {
    try {
      const result = await generateTextWithChatGPT(prompt, options)
      if (result) {
        console.log('[LLM] Successfully used ChatGPT fallback')
        return result
      }
    } catch (e: any) {
      console.warn('[LLM] ChatGPT fallback failed:', e?.message?.substring(0, 200))
    }
  }

  throw new Error('外部LLM（Claude/ChatGPT）がすべて失敗しました。ANTHROPIC_API_KEY または OPENAI_API_KEY を設定してください。')
}

// SEO用途のデフォルトモデル
// - テキスト: gemini-2.5-flash（高速・安定・高品質）
//   - 環境変数 SEO_GEMINI_TEXT_MODEL で任意のモデルを指定可能
//   - 未対応環境では自動でChatGPT APIにフォールバック
// - 画像(図解/サムネ): nano-banana-pro-preview（Gemini ネイティブ画像生成）
export const GEMINI_TEXT_MODEL_DEFAULT =
  process.env.SEO_GEMINI_TEXT_MODEL || process.env.SEO_GEMINI_CHAT_MODEL || 'gemini-2.5-flash'
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
  const isGeminiImageModel =
    lower === 'gemini-3-pro-image-preview' ||
    lower === 'gemini-2.5-flash-image' ||
    lower === 'gemini-2.5-flash-preview-image' ||
    lower === 'gemini-2.0-flash-exp'
  return lower.includes('banana') || lower.includes('image') || isAlias || isGeminiImageModel
}

function nanoBananaModelCandidates(configured: string): string[] {
  const m = normalizeModelId(configured)
  const lower = m.toLowerCase()
  const out: string[] = []

  // 設定値そのもの
  if (m) out.push(m)

  // nano-banana-pro-preview を最優先で使用
  if (!out.includes('nano-banana-pro-preview')) out.unshift('nano-banana-pro-preview')

  // フォールバック候補
  if (!out.includes('gemini-3-pro-image-preview')) out.push('gemini-3-pro-image-preview')
  if (!out.includes('gemini-2.5-flash-image')) out.push('gemini-2.5-flash-image')

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

// 空のテキストやエラー時のフォールバックモデル（順番に試行）
// NOTE: gemini-2.0-flash は 2026-03-31 廃止予定のため最後に配置
const FALLBACK_MODELS: string[] = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-2.0-flash',
]

// レート制限(429)やサーバーエラー(5xx)時にリトライ
// 404はリトライせず即返し（モデル未提供は待っても変わらない）
async function fetchWithRetry(
  endpoint: string,
  options: RequestInit,
  maxRetries = 2,
  baseDelay = 1500
): Promise<Response> {
  let lastError: Error | null = null
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(endpoint, options)

      // 成功または4xx(429以外)はそのまま返す（404含む = リトライ不要）
      if (res.ok || (res.status >= 400 && res.status < 500 && res.status !== 429)) {
        return res
      }

      // 429またはサーバーエラーはリトライ
      if (res.status === 429 || res.status >= 500) {
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 500
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
  // SEO_PRIMARY_LLM=claude の場合、Geminiを経由せず直接Claude APIを使用
  const primaryLlm = (process.env.SEO_PRIMARY_LLM || '').trim().toLowerCase()
  if (primaryLlm === 'claude' && process.env.ANTHROPIC_API_KEY) {
    const promptText = joinPartsText(req.parts)
    if (promptText) {
      try {
        return await generateTextWithClaude(promptText, {
          temperature: req.generationConfig?.temperature ?? 0.4,
          maxTokens: Math.min(req.generationConfig?.maxOutputTokens ?? 65536, 64000),
        })
      } catch (e: any) {
        console.warn('[LLM] Claude primary failed, falling back to Gemini:', e?.message?.substring(0, 200))
      }
    }
  }

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
      
      // 空のテキストが返された場合は次のモデルを試す
      if (!text) {
        console.warn(`[Gemini] Model ${model} returned empty text`)
        // まだ試していないフォールバックモデルがあれば次を試す
        const currentIndex = modelsToTry.indexOf(model)
        if (currentIndex < modelsToTry.length - 1) {
          console.log(`[Gemini] Trying next model: ${modelsToTry[currentIndex + 1]}`)
          continue
        }
        // すべてのGeminiモデルで空の場合は ChatGPT フォールバックへ
        console.log('[Gemini] All models returned empty, falling back to ChatGPT...')
        break // ループを抜けてChatGPTフォールバックへ
      }
      
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
  
  // すべてのGeminiモデルが失敗した場合、外部LLM（Claude/ChatGPT）にフォールバック
  const promptText = joinPartsText(req.parts)
  if (!promptText) {
    throw new Error('All Gemini models exhausted and no prompt text available for LLM fallback')
  }

  console.log('[Gemini] All models failed, falling back to external LLM (Claude/ChatGPT)...')
  try {
    return await generateTextWithExternalLLM(promptText, {
      temperature: req.generationConfig?.temperature ?? 0.4,
      maxTokens: Math.min(req.generationConfig?.maxOutputTokens ?? 65536, 64000),
    })
  } catch (fallbackError: any) {
    throw new Error(`All Gemini models exhausted and external LLM fallback failed: ${fallbackError?.message || 'unknown error'}`)
  }
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

  // 画像生成対応モデルのみ許可（運用上の事故防止）
  if (!isNanoBananaFamily(configured)) {
    throw new Error(
      `SEO画像生成モデル（${configured}）は画像生成対応モデルではありません。` +
        ` 環境変数 SEO_GEMINI_IMAGE_MODEL を 'nano-banana-pro-preview' に設定してください。`
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
          // Gemini ネイティブ画像生成は TEXT + IMAGE の両方が必要
          responseModalities: ['TEXT', 'IMAGE'],
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
      `Gemini 画像生成に失敗しました。SEO_GEMINI_IMAGE_MODEL を 'gemini-2.5-flash-image' または 'gemini-3-pro-image-preview' に設定してください。`
    )
  )
}


