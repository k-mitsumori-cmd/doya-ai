/**
 * Claude API ラッパー（三ツ星アプリ共通）
 *
 * 方針: 既存 `src/lib/tenkai/generation-pipeline.ts` の Raw HTTP fetch パターンを踏襲。
 * `@anthropic-ai/sdk` は敢えて導入せず依存を増やさない。
 */

import { MITSUBOSHI_CLAUDE_MODEL } from './constants'

export interface ClaudeMessagesRequest {
  systemPrompt: string
  userPrompt: string
  model?: string
  maxTokens?: number
  temperature?: number
}

export interface ClaudeMessagesResult {
  text: string
  inputTokens: number
  outputTokens: number
}

/**
 * Anthropic Messages API を呼び出す。
 *
 * 失敗時は例外を投げる（呼び出し元で Promise.allSettled で個別ハンドリング推奨）。
 */
export async function callClaudeMessages(
  req: ClaudeMessagesRequest
): Promise<ClaudeMessagesResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY が設定されていません')
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: req.model || MITSUBOSHI_CLAUDE_MODEL,
      max_tokens: req.maxTokens ?? 300,
      temperature: req.temperature ?? 0.9,
      system: req.systemPrompt,
      messages: [{ role: 'user', content: req.userPrompt }],
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`Claude API エラー (${response.status}): ${errorBody}`)
  }

  const data = await response.json()
  const text: string = data.content?.[0]?.text || ''
  return {
    text,
    inputTokens: data.usage?.input_tokens || 0,
    outputTokens: data.usage?.output_tokens || 0,
  }
}
