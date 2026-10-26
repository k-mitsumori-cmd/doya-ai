// サポートチャットの答え方を選ぶ（サーバーだけで使う。SDK を画面の側に入れないため answer.ts と分けた）
import { mockAnswerer, type SupportAnswerer } from './answer'
import { createGeminiAnswerer, geminiApiKey } from './gemini'
import { anthropicApiKey, createClaudeAnswerer } from './claude'

/**
 * 今使う答え方。
 *   SUPPORT_CHAT_AI 未設定・claude … Claude Haiku 5.5（ANTHROPIC_API_KEY が無ければモック）
 *   SUPPORT_CHAT_AI=gemini        … Gemini（予備。GOOGLE_GENAI_API_KEY が無ければモック）
 *   SUPPORT_CHAT_AI=mock          … モック（有料の AI を呼ばない）
 * ⚠️ 自動で別の有料 AI に切り替えない。失敗したらモック（answerQuestion）。
 */
export function getSupportAnswerer(
  mode: string | undefined = process.env.SUPPORT_CHAT_AI,
  keys: { anthropic?: string; gemini?: string } = { anthropic: anthropicApiKey(), gemini: geminiApiKey() },
): SupportAnswerer {
  const m = (mode ?? '').trim().toLowerCase()
  if (m === 'mock') return mockAnswerer
  if (m === 'gemini') return keys.gemini ? createGeminiAnswerer({ apiKey: keys.gemini }) : mockAnswerer
  return keys.anthropic ? createClaudeAnswerer({ apiKey: keys.anthropic }) : mockAnswerer
}
