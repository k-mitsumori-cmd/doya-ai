// ============================================
// AI が選んだ答えを、チャットの返事（ChatApiResponse）にする（API の route から使う純粋な部品）
// ============================================
// ⚠️ ここでも DB には書かない。値は、依頼の文で確かめられたものだけを残す（groundValues）。
import { AGENT_ACTIONS, routeResponse } from '@/lib/agent-router/catalog'
import { missingFields } from '@/lib/agent-router/prefill'
import type { AgentAction, AgentRoute } from '@/lib/agent-router/types'
import { groundValues } from './ground'
import { CHAT_OPS, chatOpByKey, leadText, opAsAction } from './ops'
import type { ChatApiResponse } from './types'

/** AI に渡す操作の一覧。チャットで進められる操作を先に置き、同じ id の今の案内は外す */
export function chatActions(): AgentAction[] {
  // 同じ id の今の案内と、この操作が置き換える今の案内（replaces）は外す（同じ仕事が2つ並ばないように）
  const ids = new Set(CHAT_OPS.flatMap((o) => [o.key, ...(o.replaces ? [o.replaces] : [])]))
  return [...CHAT_OPS.map(opAsAction), ...AGENT_ACTIONS.filter((a) => !ids.has(a.id))]
}

/** 確かめた AI の答え（validateReply の結果）を、画面に返す形にする */
export function chatResponse(route: AgentRoute & { planId?: string }, text: string): ChatApiResponse {
  if (route.kind === 'action') {
    const op = chatOpByKey(route.actionId)
    if (op) {
      const { values } = groundValues(text, route.values, op.fields)
      return { kind: 'op', op, values, missing: missingFields(op, values), say: leadText(op, values) }
    }
  }
  return routeResponse(route, text)
}
