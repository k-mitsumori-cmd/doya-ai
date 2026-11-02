// ============================================
// エージェントの実行の記録（作戦の保存・ToDo の取り合い・同時の上限・続きから再開）
// ============================================
// 設計: docs/architecture/agent-orchestration/DESIGN.md §8
// - 作戦（plan）と答え（answers）はサーバーが確かめてから保存する。ToDo を動かすときは、保存した作戦と答えだけを使う
//   （画面から届いた中身でツールへの入力を作らない）。
// - ToDo は「取る」（status を running にする）を条件付きの更新で行い、同じ ToDo を同時に2回動かさない。
// - 本人ごとに、同時に running の ToDo を AGENT_MAX_CONCURRENT 個までにする。
// - 動いたまま止まった ToDo（STALE_MS より古い running）は、失敗として扱い、取り直せる。
// - 「続きを進める」は、最後の実行のうち、終わっていない ToDo が残っているものを返す。
// ⚠️ 表を読む・書くのは repo（本番は runs.prisma.ts、テストは createMemoryRunRepo）。ここは決まりだけ。
// ⚠️ どの関数も userId で絞る。他人の実行は読めない。
import { AGENT_MAX_CONCURRENT, BUSY_MESSAGE } from './execute'
import { AgentTaskError, type AgentPowerUse, type AgentStates, type AgentTaskResult, type AgentTaskState, type AgentTaskStatus } from './runner'
import { planTasks } from './plan'
import type { AgentPlan, AgentRunStatus, AgentRunView } from './types'

/** running のまま、これより古いものは止まったとみなす（関数の時間 300 秒 + 余裕） */
export const STALE_MS = 6 * 60 * 1000
/** 「続きを進める」に出す実行の古さの上限 */
export const RESUME_WITHIN_MS = 7 * 86400_000

export type StoredTaskStatus = AgentTaskStatus | 'skipped'

export interface RunRow {
  id: string
  userId: string
  recipeId: string
  title: string
  request: string | null
  answers: Record<string, string>
  plan: AgentPlan
  status: AgentRunStatus
  powerUsed: number
  powerRefunded: number
  createdAt: Date
  updatedAt: Date
}

export interface TaskRow {
  id: string
  runId: string
  userId: string
  taskId: string
  action: string
  delegated: boolean
  status: StoredTaskStatus
  attempts: number
  result: AgentTaskResult | null
  resume: Record<string, string> | null
  error: string | null
  failKind: string | null
  failHref: string | null
  failHrefLabel: string | null
  powerUsed: number
  powerRefunded: number
  startedAt: Date | null
  endedAt: Date | null
}

export interface RunRepo {
  createRun(run: Omit<RunRow, 'id' | 'createdAt' | 'updatedAt' | 'powerUsed' | 'powerRefunded' | 'status'>, tasks: Pick<TaskRow, 'taskId' | 'action' | 'delegated' | 'status'>[]): Promise<RunRow>
  /** 本人の実行と ToDo。無ければ null */
  getRun(userId: string, runId: string): Promise<{ run: RunRow; tasks: TaskRow[] } | null>
  /** 本人の、新しい順の実行（since より新しいもの）。最大 limit 件 */
  listRuns(userId: string, since: Date, limit: number): Promise<{ run: RunRow; tasks: TaskRow[] }[]>
  /** 本人の running の ToDo の数（staleBefore より新しく始まったものだけ） */
  countRunning(userId: string, staleBefore: Date): Promise<number>
  /**
   * ToDo を取る。取れたときだけ true。条件: 本人の実行の、任せた ToDo で、
   * status が waiting / failed / blocked / canceled か、running でも startedAt が staleBefore より古い
   */
  claimTask(userId: string, runId: string, taskId: string, now: Date, staleBefore: Date): Promise<boolean>
  /** 取った ToDo を、取る前の状態に戻す（同時の上限を超えたと分かったとき）。running で startedAt が同じものだけ */
  unclaimTask(userId: string, runId: string, taskId: string, startedAt: Date, back: Pick<TaskRow, 'status' | 'attempts' | 'startedAt'>): Promise<void>
  /** 動いている ToDo の resume を、終わる前に書く（running で startedAt が同じもの＝自分が取ったものだけ） */
  saveResume(userId: string, runId: string, taskId: string, startedAt: Date, resume: Record<string, string>): Promise<void>
  /**
   * 取った ToDo の結果を書く（running で startedAt が同じもの＝自分が取ったものだけ）。
   * 古い試みが、6分たって取り直されたあとに終わっても、新しい試みの記録を書き換えない
   */
  finishTask(userId: string, runId: string, taskId: string, startedAt: Date, patch: Partial<TaskRow>): Promise<void>
  /** 実行の状態と、ドヤパワーの合計を書く */
  updateRun(userId: string, runId: string, patch: Partial<Pick<RunRow, 'status' | 'powerUsed' | 'powerRefunded'>>): Promise<void>
}

const RETRYABLE: StoredTaskStatus[] = ['waiting', 'failed', 'blocked', 'canceled']

/** 実行の全体の状態（ToDo の状態から） */
export function runStatusOf(tasks: Pick<TaskRow, 'status' | 'delegated'>[]): AgentRunStatus {
  const active = tasks.filter((t) => t.delegated && t.status !== 'skipped')
  if (!active.length) return 'done'
  if (active.some((t) => t.status === 'running')) return 'running'
  if (active.every((t) => t.status === 'done')) return 'done'
  if (active.every((t) => t.status === 'waiting')) return 'planned'
  return 'partial'
}

/** 保存した ToDo を、runner の状態にする（画面の runAgentTasks の prev に渡す） */
export function statesOfRun(tasks: TaskRow[], now: Date = new Date()): AgentStates {
  const out: AgentStates = {}
  for (const t of tasks) {
    if (!t.delegated || t.status === 'skipped') continue
    // 止まった running は失敗として見せる（取り直せる）
    const stale = t.status === 'running' && (!t.startedAt || now.getTime() - t.startedAt.getTime() > STALE_MS)
    const status: AgentTaskStatus = stale ? 'failed' : (t.status as AgentTaskStatus)
    const power: AgentPowerUse | undefined = t.attempts > 0 ? { used: t.powerUsed, refunded: t.powerRefunded } : undefined
    const st: AgentTaskState = {
      id: t.taskId,
      status,
      attempts: t.attempts,
      ...(t.result ? { result: t.result } : {}),
      ...(t.resume ? { resume: t.resume } : {}),
      ...(stale ? { error: '途中で止まりました。もう一度お試しください。', failure: { kind: 'tool' as const } } : t.error ? { error: t.error, failure: { kind: (t.failKind ?? 'tool') as never, href: t.failHref ?? undefined, hrefLabel: t.failHrefLabel ?? undefined } } : {}),
      ...(power ? { power } : {}),
      ...(t.startedAt ? { startedAt: t.startedAt.getTime() } : {}),
      ...(t.endedAt ? { endedAt: t.endedAt.getTime() } : {}),
    }
    out[t.taskId] = st
  }
  return out
}

/** 画面に返す形 */
export function runViewOf(run: RunRow, tasks: TaskRow[], now: Date = new Date()): AgentRunView {
  const states = statesOfRun(tasks, now)
  const remaining = tasks.filter((t) => t.delegated && t.status !== 'skipped' && states[t.taskId]?.status !== 'done').map((t) => t.taskId)
  return {
    id: run.id,
    recipeId: run.recipeId,
    title: run.title,
    plan: run.plan,
    answers: run.answers,
    status: runStatusOf(tasks.map((t) => ({ delegated: t.delegated, status: (states[t.taskId]?.status ?? t.status) as StoredTaskStatus }))),
    delegated: tasks.filter((t) => t.delegated && t.status !== 'skipped').map((t) => t.taskId),
    remaining,
    states,
    power: { used: tasks.reduce((n, t) => n + t.powerUsed, 0), refunded: tasks.reduce((n, t) => n + t.powerRefunded, 0) },
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
  }
}

/** 作戦を保存する。delegate は任せる ToDo の id（作戦に無い id・始められない ToDo は外す） */
export async function createRun(repo: RunRepo, input: { userId: string; recipeId: string; title: string; request: string | null; answers: Record<string, string>; plan: AgentPlan; delegate: string[] }): Promise<AgentRunView> {
  const want = new Set(input.delegate)
  const tasks = planTasks(input.plan).map((t) => {
    const delegated = t.delegable && t.ready.ok && want.has(t.id)
    return { taskId: t.id, action: t.action, delegated, status: (delegated ? 'waiting' : 'skipped') as StoredTaskStatus }
  })
  if (!tasks.some((t) => t.delegated)) throw new AgentTaskError('任せる ToDo を1つ以上選んでください。', 'input')
  const run = await repo.createRun({ userId: input.userId, recipeId: input.recipeId, title: input.title, request: input.request, answers: input.answers, plan: input.plan }, tasks)
  const got = await repo.getRun(input.userId, run.id)
  return runViewOf(got!.run, got!.tasks)
}

/** 「ドヤくんが進めた仕事」の一覧: 本人の実行を新しい順に（days 日まで・limit 件まで） */
export async function recentRuns(repo: RunRepo, userId: string, opts: { days: number; limit: number }, now: Date = new Date()): Promise<AgentRunView[]> {
  const rows = await repo.listRuns(userId, new Date(now.getTime() - opts.days * 86400_000), opts.limit)
  return rows.map((r) => runViewOf(r.run, r.tasks, now))
}

/** 「続きを進める」: 最後の実行のうち、終わっていない ToDo が残っているもの。無ければ null */
export async function latestOpenRun(repo: RunRepo, userId: string, now: Date = new Date()): Promise<AgentRunView | null> {
  const rows = await repo.listRuns(userId, new Date(now.getTime() - RESUME_WITHIN_MS), 5)
  for (const r of rows) {
    if (r.run.status === 'canceled') continue
    const v = runViewOf(r.run, r.tasks, now)
    if (v.remaining.length) return v
  }
  return null
}

/**
 * 保存した作戦の ToDo を1つ動かす。
 * - 任せていない ToDo・前の ToDo（after）が済んでいない ToDo は動かさない（input）
 * - 同時の上限なら動かさない（limit）。ほかで動いている同じ ToDo は動かさない（busy）
 * - 結果・失敗・ドヤパワーの量・途中まで作れたもの（resume）を書き、実行の全体の状態を更新する
 */
export async function runStoredTask(
  repo: RunRepo,
  input: { userId: string; runId: string; taskId: string; now?: () => Date; /** 利用者がやり直しのときに入れた値（会社名だけ）。保存した resume に足す */ extraResume?: Record<string, string> },
  execute: (ctx: { answers: Record<string, string>; resume?: Record<string, string>; checkpoint: (resume: Record<string, string>) => Promise<void> }) => Promise<AgentTaskResult>,
): Promise<AgentTaskResult> {
  const now = input.now ?? (() => new Date())
  const got = await repo.getRun(input.userId, input.runId)
  if (!got) throw new AgentTaskError('この作戦は見つかりませんでした。', 'input')
  const task = got.tasks.find((t) => t.taskId === input.taskId)
  if (!task || !task.delegated || task.status === 'skipped') throw new AgentTaskError('この ToDo は、ドヤくんに任せていません。', 'input')
  if (task.status === 'done' && task.result) return task.result
  const planned = planTasks(got.run.plan).find((t) => t.id === input.taskId)
  const pending = (planned?.after ?? []).filter((d) => got.tasks.find((t) => t.taskId === d)?.status !== 'done')
  if (pending.length) throw new AgentTaskError('前の ToDo が終わってから動かせます。', 'input')

  const staleBefore = new Date(now().getTime() - STALE_MS)
  if ((await repo.countRunning(input.userId, staleBefore)) >= AGENT_MAX_CONCURRENT) throw new AgentTaskError(BUSY_MESSAGE, 'limit')
  const claimedAt = now()
  if (!(await repo.claimTask(input.userId, input.runId, input.taskId, claimedAt, staleBefore))) {
    throw new AgentTaskError('この ToDo は、いま動いています。終わるまでお待ちください。', 'input')
  }
  // 数えてから取るまでのあいだに、ほかの ToDo が取られることがある。取ったあとにもう一度数え、上限を超えていたら戻して断る
  // （同時に来た呼び出しが両方とも戻すことはあるが、上限を超えて動くことはない）
  if ((await repo.countRunning(input.userId, staleBefore)) > AGENT_MAX_CONCURRENT) {
    await repo.unclaimTask(input.userId, input.runId, input.taskId, claimedAt, { status: task.status === 'running' ? 'failed' : task.status, attempts: task.attempts, startedAt: task.startedAt })
    throw new AgentTaskError(BUSY_MESSAGE, 'limit')
  }
  await repo.updateRun(input.userId, input.runId, { status: 'running' })

  const before = { used: task.powerUsed, refunded: task.powerRefunded }
  const resume = input.extraResume ? { ...(task.resume ?? {}), ...input.extraResume } : task.resume ?? undefined
  // 途中まで作れたもの。checkpoint で足していき、関数が時間の上限で止められても、次の試みが使えるように表に書く
  let current: Record<string, string> | undefined = resume
  const checkpoint = async (r: Record<string, string>) => {
    current = { ...(current ?? {}), ...r }
    await repo.saveResume(input.userId, input.runId, input.taskId, claimedAt, current)
  }
  try {
    const result = await execute({ answers: got.run.answers, resume, checkpoint })
    const p = result.power ?? { used: 0, refunded: 0 }
    await repo.finishTask(input.userId, input.runId, input.taskId, claimedAt, {
      status: 'done', result, resume: null, error: null, failKind: null, failHref: null, failHrefLabel: null,
      powerUsed: before.used + p.used, powerRefunded: before.refunded + p.refunded, endedAt: now(),
    })
    return result
  } catch (e) {
    const err = e instanceof AgentTaskError ? e : new AgentTaskError('うまく作れませんでした。もう一度お試しください。')
    const p = err.power ?? { used: 0, refunded: 0 }
    await repo.finishTask(input.userId, input.runId, input.taskId, claimedAt, {
      status: 'failed', error: err.userMessage, failKind: err.kind, failHref: err.href?.href ?? null, failHrefLabel: err.href?.label ?? null,
      resume: err.resume ?? current ?? null,
      powerUsed: before.used + p.used, powerRefunded: before.refunded + p.refunded, endedAt: now(),
    })
    throw err
  } finally {
    const after = await repo.getRun(input.userId, input.runId)
    if (after) {
      await repo.updateRun(input.userId, input.runId, {
        status: runStatusOf(after.tasks),
        powerUsed: after.tasks.reduce((n, t) => n + t.powerUsed, 0),
        powerRefunded: after.tasks.reduce((n, t) => n + t.powerRefunded, 0),
      })
    }
  }
}

/** テスト用の、メモリの上だけの記録（本番では使わない） */
export function createMemoryRunRepo(): RunRepo & { runs: RunRow[]; tasks: TaskRow[] } {
  const runs: RunRow[] = []
  const tasks: TaskRow[] = []
  let seq = 0
  const id = () => `id${++seq}`
  const own = (userId: string, runId: string) => runs.find((r) => r.id === runId && r.userId === userId)
  return {
    runs,
    tasks,
    async createRun(run, ts) {
      const at = new Date()
      const row: RunRow = { ...run, id: id(), status: 'planned', powerUsed: 0, powerRefunded: 0, createdAt: at, updatedAt: at }
      runs.push(row)
      for (const t of ts) tasks.push({ ...t, id: id(), runId: row.id, userId: run.userId, attempts: 0, result: null, resume: null, error: null, failKind: null, failHref: null, failHrefLabel: null, powerUsed: 0, powerRefunded: 0, startedAt: null, endedAt: null })
      return { ...row }
    },
    async getRun(userId, runId) {
      const r = own(userId, runId)
      return r ? { run: { ...r }, tasks: tasks.filter((t) => t.runId === r.id).map((t) => ({ ...t })) } : null
    },
    async listRuns(userId, since, limit) {
      return runs.filter((r) => r.userId === userId && r.createdAt > since).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id)).slice(0, limit)
        .map((r) => ({ run: { ...r }, tasks: tasks.filter((t) => t.runId === r.id).map((t) => ({ ...t })) }))
    },
    async countRunning(userId, staleBefore) {
      return tasks.filter((t) => t.userId === userId && t.status === 'running' && t.startedAt && t.startedAt > staleBefore).length
    },
    async claimTask(userId, runId, taskId, now, staleBefore) {
      if (!own(userId, runId)) return false
      const t = tasks.find((x) => x.runId === runId && x.taskId === taskId && x.userId === userId && x.delegated)
      if (!t) return false
      const free = RETRYABLE.includes(t.status) || (t.status === 'running' && (!t.startedAt || t.startedAt <= staleBefore))
      if (!free) return false
      Object.assign(t, { status: 'running', attempts: t.attempts + 1, startedAt: now, endedAt: null })
      return true
    },
    async unclaimTask(userId, runId, taskId, startedAt, back) {
      const t = tasks.find((x) => x.runId === runId && x.taskId === taskId && x.userId === userId && x.status === 'running' && x.startedAt?.getTime() === startedAt.getTime())
      if (t) Object.assign(t, back)
    },
    async saveResume(userId, runId, taskId, startedAt, resume) {
      const t = tasks.find((x) => x.runId === runId && x.taskId === taskId && x.userId === userId && x.status === 'running' && x.startedAt?.getTime() === startedAt.getTime())
      if (t) t.resume = { ...resume }
    },
    async finishTask(userId, runId, taskId, startedAt, patch) {
      const t = tasks.find((x) => x.runId === runId && x.taskId === taskId && x.userId === userId && x.status === 'running' && x.startedAt?.getTime() === startedAt.getTime())
      if (t) Object.assign(t, patch)
    },
    async updateRun(userId, runId, patch) {
      const r = own(userId, runId)
      if (r) Object.assign(r, patch, { updatedAt: new Date() })
    },
  }
}
