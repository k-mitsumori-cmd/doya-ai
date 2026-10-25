// ============================================
// ToDo を1つ動かす（記録の有る無しに関わらず使う部品）
// ============================================
// 設計: docs/architecture/agent-orchestration/DESIGN.md §6・§7
// - ToDo が失敗したら、その ToDo で減ったまま（戻していない）のドヤパワーを戻す（refund）。
//   例: 見積の品目の案は作れた（1 減った）が、見積書の保存で失敗した → 案は利用者に届かないので、1 を戻す。
//   ルートの包み（withDoyaPowerCharge）が自分で戻した分は、ここでは戻さない（二重に戻さない。台帳も同じ操作を2回は戻さない）。
// - 同時に動かす数を、本人ごとに上限までにする（limiter）。上限なら動かさずに断る（kind: 'limit'）。
// ⚠️ ここは純粋な部品。台帳やセッションの処理は deps でもらう。
import { AgentTaskError, type AgentCharge, type AgentTaskResult } from './runner'
import type { SalesPrepAnswers } from './recipes'
import { runSalesPrepTask, type SalesPrepTaskId, type ToolDeps } from './tools'

/** 本人ごとに同時に動かせる ToDo の数（画面の plan.concurrency と同じ） */
export const AGENT_MAX_CONCURRENT = 3

export const BUSY_MESSAGE = `同時に動かせるのは${AGENT_MAX_CONCURRENT}つまでです。いま動いている ToDo が終わってから、もう一度お試しください。`

export interface ExecuteDeps {
  tools: ToolDeps
  /** 減ったままの操作を戻し、戻した量を返す。無ければ戻さない */
  refund?: (charges: AgentCharge[]) => Promise<number>
}

/** ToDo を1つ動かす。失敗したら、減ったままの分を戻してから、失敗を投げ直す */
export async function executeSalesPrepTask(taskId: SalesPrepTaskId, a: SalesPrepAnswers, deps: ExecuteDeps, resume?: Record<string, string>): Promise<AgentTaskResult> {
  try {
    return await runSalesPrepTask(taskId, a, deps.tools, resume)
  } catch (e) {
    if (e instanceof AgentTaskError && e.charges?.length && deps.refund) {
      const back = await deps.refund(e.charges).catch(() => 0)
      if (back > 0) {
        const p = e.power ?? { used: 0, refunded: 0 }
        e.power = { used: Math.max(0, p.used - back), refunded: p.refunded + back }
      }
    }
    if (e instanceof AgentTaskError) e.charges = undefined
    throw e
  }
}

/** 本人ごとの同時に動かす数の上限（1つのサーバーの中だけで数える。記録の表があるときは、表で数える方を使う） */
export function createLimiter(max: number = AGENT_MAX_CONCURRENT) {
  const running = new Map<string, number>()
  return {
    /** 枠を1つ取る。取れなければ null。取れたら、終わったときに呼ぶ関数を返す */
    acquire(key: string): (() => void) | null {
      const n = running.get(key) ?? 0
      if (n >= max) return null
      running.set(key, n + 1)
      let released = false
      return () => {
        if (released) return
        released = true
        const m = (running.get(key) ?? 1) - 1
        if (m <= 0) running.delete(key)
        else running.set(key, m)
      }
    },
    count: (key: string) => running.get(key) ?? 0,
  }
}
