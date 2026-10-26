// ============================================
// ToDo の実行の状態を、画面の札の形にする（画面が使ってよい部品）
// ============================================
// 設計: docs/architecture/agent-orchestration/DESIGN.md §3.5
// runner の6つの状態を、画面の4つ（待つ・進む・できた・失敗した）に寄せる。
//   waiting → waiting / running → running / done → done
//   failed・blocked（前の ToDo が済まなかった）・canceled（止めた）→ failed（どれもやり直せる）
// ⚠️ 段（stage）は時間で進める表示。最後の段（…仕上げています）で待つ。ツールの本当の進み具合ではない。
import type { AgentStates, AgentTaskState } from './runner'
import type { AgentPlanTask, AgentTodoView } from './types'

export const STAGE_MS = 2600

export function todoViewOf(task: Pick<AgentPlanTask, 'id' | 'stages'>, st: AgentTaskState | undefined, now: number = Date.now()): AgentTodoView {
  const power = st?.power ?? { used: 0, refunded: 0 }
  const base = { id: task.id, power, powerKnown: st?.power !== undefined, attempts: st?.attempts ?? 0, retryable: false, stage: null as number | null }
  if (!st || st.status === 'waiting') return { ...base, status: 'waiting' }
  if (st.status === 'running') {
    const last = Math.max(0, task.stages.length - 1)
    const stage = st.startedAt !== undefined ? Math.min(last, Math.max(0, Math.floor((now - st.startedAt) / STAGE_MS))) : 0
    return { ...base, status: 'running', stage }
  }
  if (st.status === 'done' && st.result) {
    const r = st.result
    return { ...base, status: 'done', draft: { summary: r.summary, points: r.points, href: r.href, hrefLabel: r.hrefLabel } }
  }
  return {
    ...base,
    status: 'failed',
    retryable: true,
    error: {
      text: st.error ?? 'うまく作れませんでした。もう一度お試しください。',
      kind: st.failure?.kind ?? 'tool',
      href: st.failure?.href,
      hrefLabel: st.failure?.hrefLabel,
      cause: st.failure?.cause,
      // 次の一手が無い失敗（止めた・前の ToDo が済まなかった など）は、やり直すだけを出す
      actions: st.failure?.actions?.length ? st.failure.actions : [{ kind: 'retry', label: 'やり直す' }],
    },
  }
}

/** 札の数と、ドヤパワーの合計（「今◯個のツールが動いています」「失敗して戻した分」に使う） */
export function todoCounts(views: AgentTodoView[]) {
  const by = (s: AgentTodoView['status']) => views.filter((v) => v.status === s).length
  return {
    waiting: by('waiting'),
    running: by('running'),
    done: by('done'),
    failed: by('failed'),
    total: views.length,
    powerUsed: views.reduce((n, v) => n + v.power.used, 0),
    powerRefunded: views.reduce((n, v) => n + v.power.refunded, 0),
  }
}

/** 作戦の ToDo と runner の状態から、札の一覧を作る */
export function todoViews(tasks: Pick<AgentPlanTask, 'id' | 'stages'>[], states: AgentStates, now: number = Date.now()): AgentTodoView[] {
  return tasks.map((t) => todoViewOf(t, states[t.id], now))
}
