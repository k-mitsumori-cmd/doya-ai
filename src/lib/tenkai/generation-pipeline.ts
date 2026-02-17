// ============================================
// ドヤ展開AI — 生成パイプライン
// ============================================

import { validateOutput } from './validation'
import { injectBrandVoice, BrandVoiceConfig } from './brand-voice'
import { PLATFORM_PROMPTS } from './prompts/system'

const CLAUDE_MODEL = process.env.TENKAI_CLAUDE_MODEL || 'claude-sonnet-4-5-20250929'
const MAX_RETRIES = 2
const MAX_PROMPT_LENGTH = 30_000 // リトライ時のプロンプト肥大化を防止

export interface GenerationOptions {
  brandVoice?: BrandVoiceConfig | null
  templateOverride?: string | null
  customInstructions?: string | null
}

export interface GenerationResult {
  platform: string
  content: Record<string, unknown>
  charCount: number
  qualityScore: number
  tokensUsed: number
  validation: {
    isValid: boolean
    errors: string[]
    warnings: string[]
  }
}

/**
 * 単一プラットフォーム用の生成
 */
export async function generateForPlatform(
  analysis: Record<string, unknown>,
  platform: string,
  options: GenerationOptions = {}
): Promise<GenerationResult> {
  const promptModule = PLATFORM_PROMPTS[platform]
  if (!promptModule) {
    throw new Error(`未対応のプラットフォーム: ${platform}`)
  }

  let systemPrompt = promptModule.buildSystemPrompt(analysis, options.brandVoice)
  if (options.brandVoice) {
    systemPrompt = injectBrandVoice(systemPrompt, options.brandVoice)
  }

  let userPrompt = promptModule.buildUserPrompt(analysis, options.customInstructions || undefined)
  if (options.templateOverride) {
    userPrompt += `\n\n## テンプレート指定\n${options.templateOverride}`
  }

  let lastError: Error | null = null
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await callClaude(systemPrompt, userPrompt)
      const parsed = parseJsonResponse(result.text)
      const validation = validateOutput(platform, parsed)

      if (!validation.isValid && attempt < MAX_RETRIES) {
        // バリデーション失敗時のリトライ（プロンプト肥大化防止）
        const retryInstruction = `\n\n## 修正指示（前回の出力にエラーがありました）\n${validation.errors.join('\n')}\n上記のエラーを修正して再度JSON出力してください。`
        if (userPrompt.length + retryInstruction.length > MAX_PROMPT_LENGTH) {
          // プロンプトが長すぎる場合は元のプロンプトにリトライ指示のみ付加
          userPrompt = promptModule.buildUserPrompt(analysis, options.customInstructions || undefined) + retryInstruction
        } else {
          userPrompt += retryInstruction
        }
        continue
      }

      const charCount = estimateCharCount(platform, parsed)

      return {
        platform,
        content: parsed,
        charCount,
        qualityScore: validation.isValid ? 0.8 : 0.5,
        tokensUsed: result.tokensUsed,
        validation,
      }
    } catch (e: unknown) {
      lastError = e instanceof Error ? e : new Error(String(e))
      if (attempt < MAX_RETRIES) {
        // exponential backoff: 1s, 3s
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(3, attempt)))
        continue
      }
    }
  }

  throw lastError || new Error('生成に失敗しました')
}

/**
 * 複数プラットフォーム順次生成（SSE用ジェネレータ）
 */
export async function* generateForMultiplePlatforms(
  analysis: Record<string, unknown>,
  platforms: string[],
  options: GenerationOptions = {}
): AsyncGenerator<{
  type: 'generation_start' | 'generation_complete' | 'generation_error' | 'all_complete'
  platform?: string
  data?: Record<string, unknown>
  index?: number
  total?: number
}> {
  const total = platforms.length
  const results: GenerationResult[] = []

  for (let i = 0; i < platforms.length; i++) {
    const platform = platforms[i]

    yield {
      type: 'generation_start',
      platform,
      index: i,
      total,
    }

    try {
      const result = await generateForPlatform(analysis, platform, options)
      results.push(result)

      yield {
        type: 'generation_complete',
        platform,
        data: result,
        index: i,
        total,
      }
    } catch (e: unknown) {
      yield {
        type: 'generation_error',
        platform,
        data: { error: e instanceof Error ? e.message : String(e) },
        index: i,
        total,
      }
    }
  }

  yield {
    type: 'all_complete',
    data: { results, total },
  }
}

/**
 * Claude APIを呼び出し
 */
async function callClaude(
  systemPrompt: string,
  userPrompt: string
): Promise<{ text: string; tokensUsed: number }> {
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
      model: CLAUDE_MODEL,
      max_tokens: 16384,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new Error(`Claude API エラー (${response.status}): ${errorBody}`)
  }

  const data = await response.json()
  const text = data.content?.[0]?.text || ''
  const tokensUsed =
    (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0)

  return { text, tokensUsed }
}

/**
 * Claude応答からJSON部分を抽出してパース
 */
function parseJsonResponse(text: string): Record<string, unknown> {
  // ```json ... ``` ブロック内を抽出
  const jsonMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/i)
  const jsonStr = jsonMatch ? jsonMatch[1] : text

  try {
    return JSON.parse(jsonStr.trim())
  } catch {
    // JSONの開始位置を探す
    const start = jsonStr.indexOf('{')
    const end = jsonStr.lastIndexOf('}')
    if (start !== -1 && end !== -1) {
      try {
        return JSON.parse(jsonStr.slice(start, end + 1))
      } catch {
        throw new Error('Claude応答からJSONをパースできませんでした')
      }
    }
    throw new Error('Claude応答にJSON出力が見つかりませんでした')
  }
}

/**
 * プラットフォーム別の文字数推定
 */
function estimateCharCount(platform: string, content: Record<string, unknown>): number {
  switch (platform) {
    case 'note':
      return String(content.body || '').length
    case 'blog':
      return String(content.body_markdown || content.body_html || '').length
    case 'x':
      return Array.isArray(content.tweets) ? (content.tweets as Record<string, unknown>[]).reduce(
        (sum: number, t: Record<string, unknown>) => sum + String(t.text || '').length,
        0
      ) : 0
    case 'instagram':
      return String(content.caption || '').length
    case 'line':
      return Array.isArray(content.messages) ? (content.messages as Record<string, unknown>[]).reduce(
        (sum: number, m: Record<string, unknown>) => sum + String(m.text || '').length,
        0
      ) : 0
    case 'facebook':
      return String(content.post_text || '').length
    case 'linkedin':
      return String(content.post_text || '').length
    case 'newsletter':
      return String(content.body_text || content.body_html || '').length
    case 'press_release':
      return (
        String(content.lead_paragraph || '').length +
        String(content.body || '').length
      )
    default:
      return 0
  }
}
