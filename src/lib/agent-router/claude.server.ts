// ============================================
// 依頼を読んで、ツールと操作を選ぶ AI（Claude Opus 5.5）
// ============================================
// 2026-10-28 本人の指示「判定は強いモデル、軽い所は軽いモデル」。どのツールのどの操作かを選ぶのは判断なので Opus 5.5 にする。
// ⚠️ モデル ID と使い方は claude-api スキルの資料で確かめた（2026-10-28）:
//    - claude-opus-5-5（日付の付かない ID）。入力 $4 / 出力 $20（100万トークンあたり）。キャッシュの読み出しは $0.20。
//    - thinking は止められない（disabled や budget_tokens は 400）。深さは effort で決める。分類と読み取りなので low。
//    - temperature などを送ると 400。前置き（prefill）も 400。JSON は構造化出力（output_config.format）で受け取る。
//    - 安全の判定で断られたら（stop_reason: refusal）、「どれにも合わない」にする（画面は行き止まりにしない）。
// ⚠️ 1回の費用（2026-10-29 統括の監査 中3 で直した）:
//    ふだん: 一覧と決まりの文 約3,000〜3,600トークン（$4/100万）＋出力と思考 約300〜600トークン（$20/100万）→ 約 $0.02〜0.027（約3〜4円）。
//    最大: 入力 約4,500トークン＋出力の上限 2,000トークン（max_tokens）→ 約 $0.058（約8.7円）。全体の上限はこの最大で決める（route.ts）。
//    一覧が 4,096 トークンに届かないと、キャッシュは効かない見込み。軽いモデル（Haiku 5.5）にすると約 $0.0006（約0.1円）。
import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { RouterReply, ROUTER_SYSTEM_PROMPT, catalogText, requestText, type AgentPlanOption } from './router'
import type { AgentAction } from './types'

export const AGENT_ROUTER_MODEL_DEFAULT = 'claude-opus-5-5'
const TIMEOUT_MS = 25_000
/** 分類と短い値の読み取りだけなので小さめ（思考の分も含む） */
const MAX_TOKENS = 2000

export function agentRouterModel(raw: string | undefined = process.env.AGENT_ROUTER_AI_MODEL): string {
  return (raw || '').trim() || AGENT_ROUTER_MODEL_DEFAULT
}

/** Claude に送る中身（テストで形を確かめる）。一覧は system に入れてキャッシュする */
export function buildRouterRequest(text: string, today: string, actions: AgentAction[], plans: AgentPlanOption[], model = agentRouterModel()) {
  return {
    model,
    max_tokens: MAX_TOKENS,
    system: [
      { type: 'text' as const, text: ROUTER_SYSTEM_PROMPT },
      { type: 'text' as const, text: catalogText(actions, plans), cache_control: { type: 'ephemeral' as const } },
    ],
    messages: [{ role: 'user' as const, content: requestText(text, today) }],
    output_config: { effort: 'low' as const, format: zodOutputFormat(RouterReply) },
  }
}

/** テストでは messages.parse だけを持つ偽物を渡す */
export type RouterClaudeLike = { messages: { parse: (params: ReturnType<typeof buildRouterRequest>) => Promise<{ stop_reason: string | null; parsed_output?: unknown }> } }

/** AI に聞く。答えの形の確かめは router.ts の validateReply が行う。鍵が無い・断られたときは null */
export async function askRouter(text: string, today: string, actions: AgentAction[], plans: AgentPlanOption[], opts: { client?: RouterClaudeLike; apiKey?: string } = {}): Promise<unknown | null> {
  let client = opts.client ?? null
  if (!client) {
    const key = (opts.apiKey ?? process.env.ANTHROPIC_API_KEY ?? '').trim()
    if (!key) return null
    // 再試行はしない（失敗したら言葉の一致の案内に切り替える。再試行で費用が倍にならないように。2026-10-29 統括の監査 中3）
    client = new Anthropic({ apiKey: key, timeout: TIMEOUT_MS, maxRetries: 0 }) as unknown as RouterClaudeLike
  }
  const res = await client.messages.parse(buildRouterRequest(text, today, actions, plans))
  if (res.stop_reason === 'refusal' || res.parsed_output == null) return null
  return res.parsed_output
}
