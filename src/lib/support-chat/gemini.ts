// ============================================
// サポートチャットの AI（Gemini）の答え方 — 予備
// ============================================
// 2026-10-26 にユーザーが Claude Haiku 5.5 を選んだ（claude.ts）。Gemini は SUPPORT_CHAT_AI=gemini のときだけ使う予備。
// 自動の切り替え先にはしない（1回の質問で有料の AI を2つ呼ばないため）。承認の記録: gemini-2.5-flash、1回 約0.3円。
// ⚠️ 思考（thinking）のトークンは見込み額に入っていないので、thinkingBudget を 0 にする。出力も 700 トークンまで。
// ⚠️ モデルIDは腐る。末尾に gemini-flash-latest を置く（CLAUDE.md）。変えたら実 API で生存確認する。
import { knowledgeEntries, type KnowledgeEntry } from './knowledge'
import { buildUserPrompt, parseAiAnswer, SUPPORT_SYSTEM_PROMPT } from './prompt'
import type { AnswerInput, SupportAnswer, SupportAnswerer } from './answer'

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta'
export const SUPPORT_AI_MODEL_DEFAULT = 'gemini-2.5-flash'
export const SUPPORT_AI_MODEL_FALLBACK = 'gemini-flash-latest'
const TIMEOUT_MS = 15_000
const MAX_OUTPUT_TOKENS = 700

export function supportAiModels(raw: string | undefined = process.env.SUPPORT_CHAT_GEMINI_MODEL): string[] {
  const primary = (raw || '').trim() || SUPPORT_AI_MODEL_DEFAULT
  return primary === SUPPORT_AI_MODEL_FALLBACK ? [primary] : [primary, SUPPORT_AI_MODEL_FALLBACK]
}

export function geminiApiKey(): string {
  return (process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY || '').trim()
}

/** Gemini に送る本文。利用者の文は区切りの中に入れる */
export function buildGeminiRequest(input: AnswerInput, entries: KnowledgeEntry[] = knowledgeEntries()) {
  return {
    systemInstruction: { parts: [{ text: SUPPORT_SYSTEM_PROMPT }] },
    contents: [{ role: 'user', parts: [{ text: buildUserPrompt(input, entries) }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          answer: { type: 'STRING' },
          sourceIds: { type: 'ARRAY', items: { type: 'STRING' } },
          confident: { type: 'BOOLEAN' },
          needsStaff: { type: 'BOOLEAN' },
        },
        required: ['answer', 'sourceIds', 'confident', 'needsStaff'],
      },
      thinkingConfig: { thinkingBudget: 0 },
    },
  }
}

/** 互換のための名前（答えの読み方は prompt.ts の parseAiAnswer） */
export function parseGeminiReply(raw: string, question: string, entries: KnowledgeEntry[] = knowledgeEntries()): SupportAnswer {
  return parseAiAnswer(raw, question, entries)
}

/** Gemini の返事から、本文の文字列を取り出す */
export function geminiText(json: unknown): string {
  const parts = (json as { candidates?: { content?: { parts?: { text?: string }[] } }[] })?.candidates?.[0]?.content?.parts ?? []
  return parts.map((p) => p.text ?? '').join('')
}

export function createGeminiAnswerer(opts: { apiKey?: string; models?: string[]; fetchImpl?: typeof fetch } = {}): SupportAnswerer {
  return {
    name: 'gemini',
    paid: true,
    async answer(input) {
      const key = opts.apiKey ?? geminiApiKey()
      if (!key) throw new Error('Gemini API key is not configured')
      const body = JSON.stringify(buildGeminiRequest(input))
      let lastErr: unknown = null
      for (const model of opts.models ?? supportAiModels()) {
        const res = await (opts.fetchImpl ?? fetch)(`${API_BASE}/models/${encodeURIComponent(model)}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
          body,
          signal: AbortSignal.timeout(TIMEOUT_MS),
        })
        if (res.ok) return parseGeminiReply(geminiText(await res.json()), input.question)
        void res.body?.cancel().catch(() => {})
        lastErr = new Error(`Gemini ${model} returned ${res.status}`)
        // モデルが無い（廃止）ときだけ次のモデルを試す。それ以外（上限・障害）は呼び出し元でモックに切り替える
        if (res.status !== 404) break
      }
      throw lastErr ?? new Error('Gemini failed')
    },
  }
}
