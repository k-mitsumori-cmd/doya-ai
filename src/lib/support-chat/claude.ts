// ============================================
// サポートチャットの AI（Claude Haiku 5.5）の答え方
// ============================================
// 2026-10-26 ユーザーの決定: Claude Haiku 5.5（claude-haiku-5-5）。1回 約0.08円、全体の上限 800回/日（最大で月 約1,800円）。
// 開発ルール「頭を使う所は Opus、軽い所は Sonnet 以下」に合わせ、資料から選んで短く答える軽い仕事に一番軽いモデルを使う。
// ⚠️ モデル ID は claude-api スキルの資料（Migrating to Claude Haiku 5.5）で確かめた。日付の付かない固定の ID。
// ⚠️ Haiku 5.5 は temperature などを送ると 400。思考は止めずに effort を low にする（資料のおすすめ）。
//    思考の分も max_tokens に入るので、出力の上限は 1,500 にした（答えは 300 字以内。増えても 1回 約0.1円まで）。
// ⚠️ 前置き（prefill）は 400。JSON は構造化出力（output_config.format）で受け取る。
// ⚠️ 安全の判定で断られた（stop_reason: refusal）ときは「分からない」にする（運営に伝える案内が出る）。
import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod/v4' // SDK の zodOutputFormat は zod v4 の型を受け取る（zod 3.25 に同梱）
import { knowledgeEntries, type KnowledgeEntry } from './knowledge'
import { buildUserPrompt, parseAiAnswer, SUPPORT_SYSTEM_PROMPT } from './prompt'
import type { AnswerInput, SupportAnswerer } from './answer'

export const SUPPORT_CLAUDE_MODEL_DEFAULT = 'claude-haiku-5-5'
const TIMEOUT_MS = 20_000
const MAX_TOKENS = 1500

export const SupportAiReply = z.object({
  answer: z.string(),
  sourceIds: z.array(z.string()),
  confident: z.boolean(),
  needsStaff: z.boolean(),
})

export function supportClaudeModel(raw: string | undefined = process.env.SUPPORT_CHAT_AI_MODEL): string {
  return (raw || '').trim() || SUPPORT_CLAUDE_MODEL_DEFAULT
}

export function anthropicApiKey(): string {
  return (process.env.ANTHROPIC_API_KEY || '').trim()
}

/** Claude に送る中身（テストで形を確かめる） */
export function buildClaudeRequest(input: AnswerInput, model = supportClaudeModel(), entries: KnowledgeEntry[] = knowledgeEntries()) {
  return {
    model,
    max_tokens: MAX_TOKENS,
    system: SUPPORT_SYSTEM_PROMPT,
    messages: [{ role: 'user' as const, content: buildUserPrompt(input, entries) }],
    output_config: { effort: 'low' as const, format: zodOutputFormat(SupportAiReply) },
  }
}

/** テストでは messages.parse だけを持つ偽物を渡す */
export type ClaudeLike = { messages: { parse: (params: ReturnType<typeof buildClaudeRequest>) => Promise<{ stop_reason: string | null; parsed_output?: unknown }> } }

export function createClaudeAnswerer(opts: { apiKey?: string; client?: ClaudeLike; model?: string } = {}): SupportAnswerer {
  let client = opts.client ?? null
  return {
    name: 'claude',
    paid: true,
    async answer(input) {
      if (!client) {
        const key = opts.apiKey ?? anthropicApiKey()
        if (!key) throw new Error('Anthropic API key is not configured')
        // 失敗の再試行は1回まで（呼び出し元がモックに切り替える）
        client = new Anthropic({ apiKey: key, timeout: TIMEOUT_MS, maxRetries: 1 }) as unknown as ClaudeLike
      }
      const res = await client.messages.parse(buildClaudeRequest(input, opts.model ?? supportClaudeModel()))
      if (res.stop_reason === 'refusal' || res.parsed_output == null) return parseAiAnswer(null, input.question)
      return parseAiAnswer(res.parsed_output, input.question)
    },
  }
}
