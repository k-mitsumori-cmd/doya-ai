// ============================================
// 「ドヤくんが進めた仕事」（経営ホームの直近の数件と、/home/work の一覧）
// ============================================
// 2026-11-01 本人の指示「進めたタスクを全部見れるようにしてください」。
// データは保存済みの作戦（ゴール・柱・ToDo・下書き）から作る。新しい表は使わない。
// - 記録が使える設定（AGENT_RUNS_STORE=db）: GET /api/agent/runs（本人の実行。90日・100件まで）
// - 記録を使わない設定（404）・見本: この端末に残した作戦（localStorage、新しい順に30件まで）
// ⚠️ 状態は「下書き」だけを出す。確かめ済み・送ったは、まだどこにも記録していないので出さない（作り物を出さない）。
import { planTasks } from '@/lib/agent-orchestration/plan'
import type { AgentStates } from '@/lib/agent-orchestration/runner'
import type { AgentDraftDetail, AgentPlan, AgentRunView } from '@/lib/agent-orchestration/types'

export const HISTORY_KEY = 'doya-home-agent:history:v1'
const HISTORY_MAX = 30

export type WorkStatus = 'done' | 'failed' | 'open'

/** 一覧の1行（ToDo 1件） */
export interface WorkItem {
  key: string
  tool: string
  toolName: string
  title: string
  /** 作戦のゴールの一文 */
  goal: string
  /** 最後に動いた時刻（ISO 8601） */
  at: string
  status: WorkStatus
  summary: string | null
  points: string[]
  detail?: AgentDraftDetail
  href: string | null
  hrefLabel: string | null
}

/** 端末に残す作戦（HomeAgent の SavedRun と同じ形に、端末の中の id を足したもの） */
export interface LocalRun {
  localId: string
  plan: AgentPlan
  delegate: Record<string, boolean>
  states: AgentStates
  savedAt: number
}

export function loadLocalRuns(): LocalRun[] {
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY)
    const v = raw ? (JSON.parse(raw) as LocalRun[]) : []
    return Array.isArray(v) ? v.filter((r) => r && r.plan && r.states) : []
  } catch {
    return []
  }
}

/** 端末の一覧に、作戦を足す（同じ localId なら置き換えて先頭へ） */
export function saveLocalRun(run: LocalRun) {
  try {
    const list = [run, ...loadLocalRuns().filter((r) => r.localId !== run.localId)].slice(0, HISTORY_MAX)
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(list))
  } catch { /* 残せなくても画面は動かす */ }
}

function itemsOf(key: string, plan: AgentPlan, delegated: (id: string) => boolean, states: AgentStates, fallbackAt: string): WorkItem[] {
  return planTasks(plan)
    .filter((t) => delegated(t.id) && states[t.id])
    .map((t) => {
      const st = states[t.id]
      const r = st.status === 'done' ? st.result : undefined
      const status: WorkStatus = st.status === 'done' ? 'done' : st.status === 'failed' || st.status === 'blocked' || st.status === 'canceled' ? 'failed' : 'open'
      const at = st.endedAt ?? st.startedAt
      return {
        key: `${key}:${t.id}`,
        tool: t.tool,
        toolName: t.toolName,
        title: t.title,
        goal: plan.goal.statement,
        at: at ? new Date(at).toISOString() : fallbackAt,
        status,
        summary: r?.summary ?? (status === 'failed' ? st.error ?? '作れませんでした。' : null),
        points: r?.points ?? [],
        ...(r?.detail ? { detail: r.detail } : {}),
        href: r?.href ?? null,
        hrefLabel: r?.hrefLabel ?? null,
      }
    })
}

export function itemsOfRuns(runs: AgentRunView[]): WorkItem[] {
  return runs.flatMap((r) => itemsOf(r.id, r.plan, (id) => r.delegated.includes(id), r.states, r.updatedAt))
}

export function itemsOfLocal(runs: LocalRun[]): WorkItem[] {
  return runs.flatMap((r) => itemsOf(r.localId, r.plan, (id) => r.delegate[id] ?? false, r.states, new Date(r.savedAt).toISOString()))
}

/** 新しい順に並べる */
export function sortItems(items: WorkItem[]): WorkItem[] {
  return [...items].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
}

/** 進めた仕事を読む。記録が使えない設定（404）なら端末の分。読めないときは端末の分と、読めなかったことを返す */
export async function readWorkItems(executor: 'api' | 'sample'): Promise<{ items: WorkItem[]; from: 'server' | 'device'; failed: boolean }> {
  const local = () => sortItems(itemsOfLocal(loadLocalRuns()))
  if (executor === 'sample') return { items: local(), from: 'device', failed: false }
  try {
    const res = await fetch('/api/agent/runs', { cache: 'no-store' })
    if (res.status === 404) return { items: local(), from: 'device', failed: false }
    if (!res.ok) return { items: local(), from: 'device', failed: true }
    const data = (await res.json().catch(() => null)) as { runs?: AgentRunView[] } | null
    return { items: sortItems(itemsOfRuns(data?.runs ?? [])), from: 'server', failed: false }
  } catch {
    return { items: local(), from: 'device', failed: true }
  }
}

/** 日時の出し方（日本時間・「11月1日 19:30」） */
export function workTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export const WORK_STATUS_LABEL: Record<WorkStatus, string> = { done: '下書き', failed: '作れませんでした', open: '途中' }
