// ============================================
// ToDo を1つ動かす（記録の有る無しに関わらず使う部品）と、同時に動かす数の上限
// ============================================
// 設計: docs/architecture/agent-orchestration/DESIGN.md §6・§7
// - ドヤパワーを戻すのは、AI の生成そのものが失敗したときだけ。それは各ツールのルートの包み（withDoyaPowerCharge）が行う。
//   生成ができて保存だけが失敗したときは戻さない。できた案を resume に残し、やり直しは AI を呼ばずに保存だけを行う
//   （2026-10-25 ユーザー決定。わざと保存で失敗させて、AI を無料で何度も呼べないようにする）。
// - 同時に動かす数を、本人ごとに上限までにする（limiter）。上限なら動かさずに断る（kind: 'limit'）。
import type { AgentTaskResult } from './runner'
import type { SalesPrepAnswers } from './recipes'
import { runSalesPrepTask, type SalesPrepTaskId, type ToolDeps } from './tools'

/** 本人ごとに同時に動かせる ToDo の数（画面の plan.concurrency と同じ。2026-10-25 ユーザー決定で 3） */
export const AGENT_MAX_CONCURRENT = 3

export const BUSY_MESSAGE = `同時に動かせるのは${AGENT_MAX_CONCURRENT}つまでです。いま動いている ToDo が終わってから、もう一度お試しください。`

export interface ExecuteDeps {
  tools: ToolDeps
}

/** ToDo を1つ動かす */
export async function executeSalesPrepTask(taskId: SalesPrepTaskId, a: SalesPrepAnswers, deps: ExecuteDeps, resume?: Record<string, string>): Promise<AgentTaskResult> {
  return runSalesPrepTask(taskId, a, deps.tools, resume)
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
