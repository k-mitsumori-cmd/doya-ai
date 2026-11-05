// ============================================
// 左のメニューの「動いているタスク」の件数（ドヤくんに任せた ToDo の数）
// ============================================
// - 実行中: 任せた ToDo のうち running のもの。STALE_MS より古い running は止まったとみなし、失敗に数える（statesOfRun と同じ決まり）
// - できた: DONE_WITHIN_MS の間に終わった ToDo
// - 止まった: DONE_WITHIN_MS の間に失敗した ToDo（取り直せる）。待っている（waiting）ものは「これから」
// ⚠️ 数えるのは本人の実行だけ（repo.listRuns が userId で絞る）。中身（作戦・答え・結果）は返さない。
// ⚠️ 表を読む・書く決まりは runs.ts。ここは数えるだけ。
// - 製品で絞るとき（旗 PRODUCT_HUBS_ROLLOUT の内側。2026-11-02 段3）は、操作のツールがその製品に入るものだけを数える。経営管理は全部
import { RESUME_WITHIN_MS, STALE_MS, type RunRepo, type TaskRow } from './runs'
import { ACTION_CATALOG, isAgentAction } from './plan'
import { getProduct, type ProductId } from '@/lib/products'

/** 「できた」に数える古さの上限（終わったばかりのものだけ） */
export const DONE_WITHIN_MS = 24 * 3600_000
/** 数える実行の数の上限（新しい順） */
const RUN_LIMIT = 20

export interface AgentTaskCounts {
  running: number
  waiting: number
  done: number
  failed: number
}

/** 操作がその製品のツールのものか（経営管理と、絞らないときは全部。知らない操作は経営管理だけで数える） */
export function actionInProduct(action: string | undefined, product: ProductId | null): boolean {
  if (!product || product === 'management') return true
  if (!action || !isAgentAction(action)) return false
  return getProduct(product).toolIds.includes(ACTION_CATALOG[action].tool)
}

export function countAgentTasks(rows: { run: { status: string }; tasks: (Pick<TaskRow, 'delegated' | 'status' | 'startedAt' | 'endedAt'> & { action?: string })[] }[], now: Date = new Date(), product: ProductId | null = null): AgentTaskCounts {
  const out: AgentTaskCounts = { running: 0, waiting: 0, done: 0, failed: 0 }
  const t = now.getTime()
  const recent = (d: Date | null) => Boolean(d) && t - (d as Date).getTime() <= DONE_WITHIN_MS
  for (const r of rows) {
    if (r.run.status === 'canceled') continue
    for (const task of r.tasks) {
      if (!task.delegated || task.status === 'skipped') continue
      if (!actionInProduct(task.action, product)) continue
      if (task.status === 'running') {
        const stale = !task.startedAt || t - task.startedAt.getTime() > STALE_MS
        if (!stale) out.running++
        else if (recent(task.startedAt)) out.failed++
      } else if (task.status === 'waiting') out.waiting++
      else if (task.status === 'done') { if (recent(task.endedAt)) out.done++ }
      else if (task.status === 'failed' || task.status === 'blocked') { if (recent(task.endedAt)) out.failed++ }
    }
  }
  return out
}

export async function agentTaskCounts(repo: RunRepo, userId: string, now: Date = new Date(), product: ProductId | null = null): Promise<AgentTaskCounts> {
  const rows = await repo.listRuns(userId, new Date(now.getTime() - RESUME_WITHIN_MS), RUN_LIMIT)
  return countAgentTasks(rows, now, product)
}
