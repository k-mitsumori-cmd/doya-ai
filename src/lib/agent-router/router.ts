// ============================================
// 依頼を読んで、ツールと操作を選ぶ（AI に渡す文と、答えの確かめ。画面にも API にも依らない純粋な部品）
// ============================================
// ⚠️ AI の答えはそのまま使わない。操作の id が一覧にあるか、値が欄の形に合うかを、ここで確かめる。
// ⚠️ 値は、依頼の文にはっきり書かれたものだけを入れさせる（作り話をさせない）。
import { z } from 'zod/v4'
import { cleanValues } from './prefill'
import type { AgentAction, AgentRoute } from './types'

/** 作戦（複数の手順に分ける型）の一覧。今は商談の準備だけ（recipes.ts） */
export interface AgentPlanOption { id: string; title: string; description: string }

/** AI が返す形（構造化出力で受け取る） */
export const RouterReply = z.object({
  /** action: 1つのツールの1つの操作で済む / plan: 作戦の型に合う、複数の手順が要る / unknown: どれにも合わない */
  kind: z.enum(['action', 'plan', 'unknown']),
  /** kind が action のときの操作の id（それ以外は ''） */
  actionId: z.string(),
  /** kind が plan のときの作戦の id（それ以外は ''） */
  planId: z.string(),
  /** 依頼の文から読み取れた値。key は操作の欄の key */
  values: z.array(z.object({ key: z.string(), value: z.string() })),
  /** unknown のとき、近い操作の id（3つまで） */
  suggestions: z.array(z.string()),
  /** 選んだ理由（日本語・1文） */
  reason: z.string(),
})
export type RouterReplyT = z.infer<typeof RouterReply>

export const ROUTER_SYSTEM_PROMPT = [
  'あなたは、業務ツール群「ドヤAI」の受付です。利用者の依頼の文を読み、どのツールのどの操作で進めるかを1つ選びます。',
  '選び方:',
  '- 1つのツールの1つの操作（作る・登録する・調べる・開く）で済む依頼は kind="action" にし、操作の一覧から最も合う id を actionId に入れる。',
  '- 作戦の一覧にある型に合い、複数のツールをまたぐ依頼（例: 商談の準備をまとめて進めたい）は kind="plan" にし、planId を入れる。',
  '- どれにも合わないときだけ kind="unknown" にし、近い操作の id を suggestions に3つまで入れる。',
  '値の読み取り:',
  '- values には、依頼の文にはっきり書かれている値だけを入れる。推測や例の値を作らない。',
  '- key は、選んだ操作の欄の key を使う。金額（yen）は円の整数（20万円→200000）。日付（date）は YYYY-MM-DD（「来週月曜」などは、今日の日付から計算する）。URL はそのまま。',
  '- 読み取れない値は入れない（足りない値は、あとで利用者に聞く）。',
  'reason は、選んだ理由を日本語の1文で書く。',
].join('\n')

/** AI に渡す操作の一覧（毎回同じ文にして、キャッシュが効くようにする） */
export function catalogText(actions: AgentAction[], plans: AgentPlanOption[]): string {
  const lines = ['# 操作の一覧（id / ツール / できること / 欄）']
  for (const a of actions) {
    const fields = a.fields.map((f) => `${f.key}:${f.type}${f.required ? '(必須)' : ''}=${f.label}${f.hint ? `（${f.hint}）` : ''}`).join(', ')
    lines.push(`- ${a.id} / ${a.toolId} / ${a.label}。${a.description} / 欄: ${fields || 'なし'}`)
  }
  lines.push('', '# 作戦の一覧（id / 名前 / どんな依頼か）')
  for (const p of plans) lines.push(`- ${p.id} / ${p.title} / ${p.description}`)
  return lines.join('\n')
}

/** 依頼の文（毎回変わる部分）。今日の日付を添える */
export function requestText(text: string, todayYmd: string): string {
  return `今日の日付: ${todayYmd}（日本時間）\n依頼: ${text.slice(0, 500)}`
}

/** AI の答えを確かめて、画面に使える形にする */
export function validateReply(reply: unknown, actions: AgentAction[], plans: AgentPlanOption[]): AgentRoute & { planId?: string } {
  const r = RouterReply.safeParse(reply)
  if (!r.success) return { kind: 'unknown', reason: '', suggestions: [] }
  const v = r.data
  const reason = v.reason.slice(0, 200)
  if (v.kind === 'action') {
    const action = actions.find((a) => a.id === v.actionId)
    if (action) {
      const raw: Record<string, string> = {}
      for (const { key, value } of v.values.slice(0, 20)) raw[key] = value
      const values = cleanValues(action, raw)
      return { kind: 'action', actionId: action.id, values, missing: action.fields.filter((f) => f.required && !values[f.key]).map((f) => f.key), reason }
    }
  }
  if (v.kind === 'plan') {
    const plan = plans.find((p) => p.id === v.planId)
    if (plan) return { kind: 'plan', reason, planId: plan.id }
  }
  const suggestions = v.suggestions.filter((id) => actions.some((a) => a.id === id)).slice(0, 3)
  return { kind: 'unknown', reason, suggestions }
}

/** 日本時間の今日（YYYY-MM-DD） */
export function jstToday(now = Date.now()): string {
  return new Date(now + 9 * 3_600_000).toISOString().slice(0, 10)
}
