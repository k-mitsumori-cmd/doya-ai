// ============================================
// 作戦づくりの API（POST /api/agent/plan、Accept: application/x-ndjson）の流れを読む
// ============================================
// 1行に1つの知らせ（AgentPlanEvent）が届く。source → reason → result（または error）で終わる。
// ⚠️ 画面の部品から使う純粋な部品（テストで差し替えられるよう、読み手と知らせの受け手は引数でもらう）。
import type { AgentPlanEvent } from '@/lib/agent-orchestration/types'

const KNOWN = new Set(['source', 'reason', 'result', 'error'])

/** 1行を知らせにする。形が違う行は捨てる（null） */
export function parsePlanLine(line: string): AgentPlanEvent | null {
  const t = line.trim()
  if (!t) return null
  try {
    const v = JSON.parse(t) as { type?: unknown }
    return v && typeof v === 'object' && typeof v.type === 'string' && KNOWN.has(v.type) ? (v as AgentPlanEvent) : null
  } catch {
    return null
  }
}

/**
 * 流れを最後まで読み、知らせを1つずつ onEvent に渡す。result か error で終わる。
 * 終わりの知らせが来ないまま流れが切れたら、error の知らせを渡す（画面を止めたままにしない）。
 */
export async function readPlanStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (e: AgentPlanEvent) => void,
): Promise<AgentPlanEvent> {
  const reader = body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  let last: AgentPlanEvent | null = null
  const take = (line: string) => {
    const e = parsePlanLine(line)
    if (!e) return
    onEvent(e)
    if (e.type === 'result' || e.type === 'error') last = e
  }
  for (;;) {
    const { value, done } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    let i: number
    while ((i = buf.indexOf('\n')) >= 0) {
      take(buf.slice(0, i))
      buf = buf.slice(i + 1)
    }
  }
  take(buf + dec.decode())
  if (last) return last
  const cut: AgentPlanEvent = { type: 'error', text: '作戦を最後まで受け取れませんでした。もう一度お試しください。' }
  onEvent(cut)
  return cut
}
