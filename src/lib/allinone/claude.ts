/**
 * Claude API ラッパー（ドヤマーケAI 用）
 * 既存 mitsuboshi/_shared/anthropic.ts のパターン踏襲。
 * Raw HTTP fetch で Messages API を呼ぶ。ストリーミング対応。
 */

const MODEL_POWER = 'claude-sonnet-4-6'       // 高精度な JSON 出力用
const MODEL_FAST = 'claude-haiku-4-5-20251001' // 軽量応答

export interface ClaudeMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ClaudeCallOptions {
  systemPrompt: string
  messages: ClaudeMessage[]
  model?: 'power' | 'fast' | string
  maxTokens?: number
  temperature?: number
  jsonMode?: boolean    // JSON の抽出を強制
}

export interface ClaudeResult {
  text: string
  json: any | null
  inputTokens: number
  outputTokens: number
  model: string
}

const ANTHROPIC_ENDPOINT = 'https://api.anthropic.com/v1/messages'

function pickModel(m?: 'power' | 'fast' | string): string {
  if (!m || m === 'power') return MODEL_POWER
  if (m === 'fast') return MODEL_FAST
  return m
}

/**
 * Claude を 1 回呼ぶ（ストリーミングしない）。
 * JSON 抽出も面倒みる。
 */
export async function callClaude(opts: ClaudeCallOptions): Promise<ClaudeResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY が設定されていません')

  const model = pickModel(opts.model)

  const res = await fetch(ANTHROPIC_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: opts.maxTokens ?? 4096,
      temperature: opts.temperature ?? 0.7,
      system: opts.systemPrompt,
      messages: opts.messages,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Claude API error (${res.status}): ${body.slice(0, 400)}`)
  }

  const data = await res.json()
  const text: string = (data.content ?? [])
    .map((c: any) => (c.type === 'text' ? c.text : ''))
    .join('')

  const json = opts.jsonMode ? extractJson(text) : null

  return {
    text,
    json,
    inputTokens: data.usage?.input_tokens || 0,
    outputTokens: data.usage?.output_tokens || 0,
    model,
  }
}

/**
 * ストリーミング対応版。コールバックでトークンを受け取る。
 */
export async function streamClaude(
  opts: ClaudeCallOptions,
  onToken: (text: string) => void
): Promise<ClaudeResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY が設定されていません')

  const model = pickModel(opts.model)

  const res = await fetch(ANTHROPIC_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: opts.maxTokens ?? 4096,
      temperature: opts.temperature ?? 0.8,
      system: opts.systemPrompt,
      messages: opts.messages,
      stream: true,
    }),
  })

  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => '')
    throw new Error(`Claude API error (${res.status}): ${body.slice(0, 400)}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let fullText = ''
  let inputTokens = 0
  let outputTokens = 0

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let lineEnd
    while ((lineEnd = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, lineEnd).trim()
      buffer = buffer.slice(lineEnd + 1)
      if (!line.startsWith('data:')) continue
      const payload = line.slice(5).trim()
      if (!payload || payload === '[DONE]') continue
      try {
        const ev = JSON.parse(payload)
        if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') {
          const t: string = ev.delta.text || ''
          if (t) {
            fullText += t
            onToken(t)
          }
        } else if (ev.type === 'message_delta') {
          outputTokens = ev.usage?.output_tokens ?? outputTokens
        } else if (ev.type === 'message_start') {
          inputTokens = ev.message?.usage?.input_tokens ?? 0
          outputTokens = ev.message?.usage?.output_tokens ?? 0
        }
      } catch {
        /* noop */
      }
    }
  }

  const json = opts.jsonMode ? extractJson(fullText) : null
  return { text: fullText, json, inputTokens, outputTokens, model }
}

/**
 * テキスト中から JSON を取り出す。
 * ```json ... ``` コードブロックや、{...}/[...] の形に対応。
 */
export function extractJson(text: string): any | null {
  if (!text) return null
  const fenced = text.match(/```(?:json)?\s*([\s\S]+?)\s*```/i)
  const candidates: string[] = []
  if (fenced) candidates.push(fenced[1])
  // {...}
  const objMatch = text.match(/\{[\s\S]*\}/)
  if (objMatch) candidates.push(objMatch[0])
  // [...]
  const arrMatch = text.match(/\[[\s\S]*\]/)
  if (arrMatch) candidates.push(arrMatch[0])

  for (const c of candidates) {
    try {
      return JSON.parse(c)
    } catch {
      /* try next */
    }
  }
  return null
}
