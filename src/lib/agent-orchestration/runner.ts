// ============================================
// 複数のツールを同時に動かす部品（順番の決まりと、やり直し・中断）
// ============================================
// 設計: docs/architecture/agent-orchestration/DESIGN.md §6
// - 前の作業（dependsOn）が済んだものから、同時に concurrency 個まで動かす。
// - 失敗した作業だけをやり直せる。済んだ作業の結果は前の状態（prev）から引き継ぐ。
// - 前の作業が失敗したら、あとの作業は動かさずに「blocked」にする（やり直しで動く）。
// - 中断（signal）したら、まだ始めていない作業は「canceled」にする。動いている作業には signal を渡す。
// ⚠️ ここは純粋な部品。画面（クライアント）からも、テストからも使う。fetch や DB はここに書かない（execute が持つ）。

export type AgentTaskStatus = 'waiting' | 'running' | 'done' | 'failed' | 'blocked' | 'canceled'

export interface AgentTaskSpec {
  id: string
  /** 前に済んでいる必要がある作業の id */
  dependsOn?: string[]
}

/** ドヤパワーの減った量と戻した量（減る量の表から数える目安。作り直しの半額などで実際と違うことがある） */
export interface AgentPowerUse {
  used: number
  refunded: number
}

/** できた物の中身（ツールごとの形）。保存した下書きの値から作る（作り物を入れない） */
export type AgentDraftDetail =
  | { kind: 'company'; name: string }
  | { kind: 'quote'; rows: { name: string; qty: number; unit: string; unitPrice: number }[]; count: number; subtotal: number }
  | { kind: 'slides'; heads: string[] }

export interface AgentTaskResult {
  /** 結果の一文（30〜45字ほど） */
  summary: string
  /** 結果の要点（3〜6行） */
  points: string[]
  /** 各ツールの画面で結果を開くリンク */
  href: string
  hrefLabel: string
  /** できた物の中身（完成の画面のカードに出す。会社名・見積の品目・スライドの見出し）。古い記録には無い */
  detail?: AgentDraftDetail
  /** 次の作業に渡す材料（ペルソナの要約など）。画面には出さない */
  handoff?: Record<string, string>
  /** このタスクで減ったドヤパワー（ドヤパワーを使わない人は 0） */
  power?: AgentPowerUse
}

export interface AgentTaskState {
  id: string
  status: AgentTaskStatus
  attempts: number
  result?: AgentTaskResult
  /** 利用者に見せる失敗の一文（ステータスコードは入れない） */
  error?: string
  /** 失敗の種類と、開くとよい画面 */
  failure?: { kind: AgentFailureKind; href?: string; hrefLabel?: string; cause?: string; actions?: AgentFailureAction[] }
  /** これまでの試みで減った・戻したドヤパワー（試みごとに足していく） */
  power?: AgentPowerUse
  startedAt?: number
  endedAt?: number
  /** 途中まで作れたもの（スライドのプロジェクトの id など）。やり直しのときに execute へ渡し、二重に作らない */
  resume?: Record<string, string>
}

export type AgentStates = Record<string, AgentTaskState>

export interface RunOptions<T extends AgentTaskSpec> {
  tasks: readonly T[]
  execute: (task: T, ctx: { signal: AbortSignal; upstream: Record<string, AgentTaskResult>; resume?: Record<string, string> }) => Promise<AgentTaskResult>
  /** 同時に動かす数（既定 3） */
  concurrency?: number
  /** 前の実行の状態。done の作業は動かさずに引き継ぐ（失敗した作業だけのやり直し） */
  prev?: AgentStates
  signal?: AbortSignal
  onChange?: (states: AgentStates) => void
  now?: () => number
}

/** ドヤパワーの使った量を足す */
export function addPower(a?: AgentPowerUse, b?: AgentPowerUse): AgentPowerUse | undefined {
  if (!a && !b) return undefined
  return { used: (a?.used ?? 0) + (b?.used ?? 0), refunded: (a?.refunded ?? 0) + (b?.refunded ?? 0) }
}

/** 失敗の一文。Error の文はそのまま使わず、決まった文にする（中身に内部の言葉が混ざるため） */
export function failureText(e: unknown): string {
  if (e instanceof AgentTaskError) return e.userMessage
  if ((e as { name?: string })?.name === 'AbortError') return '止めました。'
  return 'うまく作れませんでした。もう一度お試しください。'
}

export type AgentFailureKind = 'limit' | 'power' | 'auth' | 'setup' | 'input' | 'tool'

/**
 * 失敗のときに出す「次の一手」（FAILURE-CHECKLIST.md）
 * - retry: そのままやり直す
 * - href: 画面を開く（組織を作る・料金を見る・ログインする）
 * - input: 値を入れてやり直す（いまは会社名だけ。入れた値は resume に入れて送り返す）
 */
export type AgentFailureAction =
  | { kind: 'retry'; label: string }
  | { kind: 'href'; label: string; href: string }
  | { kind: 'input'; label: string; field: 'companyName'; placeholder: string }

/** 利用者に見せてよい文を持つ失敗（上限・ドヤパワー不足・未ログインなど） */
export class AgentTaskError extends Error {
  constructor(
    public userMessage: string,
    public kind: AgentFailureKind = 'tool',
    /** 途中まで作れたもの（やり直しで使う） */
    public resume?: Record<string, string>,
    /** 失敗のときに開くとよい画面（組織の作成・料金など） */
    public href?: { href: string; label: string },
    /** 失敗までに減った・戻したドヤパワー */
    public power?: AgentPowerUse,
  ) {
    super(userMessage)
    this.name = 'AgentTaskError'
  }

  /** 原因の短い名前（timeout・dns・limit_reached など）。画面の出し分けと記録に使う */
  cause?: string
  /** 次の一手 */
  actions?: AgentFailureAction[]

  /** 原因と次の一手を付ける */
  withHelp(cause: string, actions: AgentFailureAction[]): this {
    this.cause = cause
    this.actions = actions
    return this
  }
}

/** 実行の前の状態を作る。prev の done は引き継ぎ、それ以外は waiting に戻す */
export function initialStates(tasks: readonly AgentTaskSpec[], prev?: AgentStates): AgentStates {
  const out: AgentStates = {}
  for (const t of tasks) {
    const p = prev?.[t.id]
    out[t.id] = p && p.status === 'done' ? { ...p } : { id: t.id, status: 'waiting', attempts: p?.attempts ?? 0, resume: p?.resume, power: p?.power }
  }
  return out
}

/** 依存の決まりが正しいか（知らない id・自分自身・循環が無いか）。正しくなければ理由を返す */
export function validateTasks(tasks: readonly AgentTaskSpec[]): string | null {
  const ids = new Set(tasks.map((t) => t.id))
  if (ids.size !== tasks.length) return 'duplicate id'
  for (const t of tasks) for (const d of t.dependsOn ?? []) {
    if (!ids.has(d)) return `unknown dependency: ${d}`
    if (d === t.id) return `self dependency: ${d}`
  }
  const seen = new Set<string>()
  const stack = new Set<string>()
  const byId = new Map(tasks.map((t) => [t.id, t]))
  const visit = (id: string): boolean => {
    if (stack.has(id)) return false
    if (seen.has(id)) return true
    stack.add(id)
    for (const d of byId.get(id)?.dependsOn ?? []) if (!visit(d)) return false
    stack.delete(id)
    seen.add(id)
    return true
  }
  for (const t of tasks) if (!visit(t.id)) return 'cycle'
  return null
}

/** 今動いている作業の数 */
export function runningCount(states: AgentStates): number {
  return Object.values(states).filter((s) => s.status === 'running').length
}

/** 済んだ・失敗・止まった作業の数と、全体の数 */
export function progressOf(states: AgentStates): { done: number; failed: number; running: number; total: number; finished: boolean } {
  const all = Object.values(states)
  const done = all.filter((s) => s.status === 'done').length
  const failed = all.filter((s) => s.status === 'failed' || s.status === 'blocked' || s.status === 'canceled').length
  const running = all.filter((s) => s.status === 'running').length
  return { done, failed, running, total: all.length, finished: running === 0 && all.every((s) => s.status !== 'waiting') }
}

/** 作業を、決まりどおりに同時に動かす。すべてが終わる（済む・失敗・止まる）と、最後の状態を返す */
export async function runAgentTasks<T extends AgentTaskSpec>(opts: RunOptions<T>): Promise<AgentStates> {
  const bad = validateTasks(opts.tasks)
  if (bad) throw new Error(`invalid tasks: ${bad}`)
  const limit = Math.max(1, Math.floor(opts.concurrency ?? 3))
  const now = opts.now ?? Date.now
  const states = initialStates(opts.tasks, opts.prev)
  const ctrl = new AbortController()
  const onAbort = () => ctrl.abort()
  if (opts.signal) {
    if (opts.signal.aborted) ctrl.abort()
    else opts.signal.addEventListener('abort', onAbort, { once: true })
  }
  const emit = () => opts.onChange?.(Object.fromEntries(Object.entries(states).map(([k, v]) => [k, { ...v }])))
  const set = (id: string, patch: Partial<AgentTaskState>) => { states[id] = { ...states[id], ...patch }; emit() }

  return new Promise<AgentStates>((resolve) => {
    let active = 0
    const finish = () => {
      opts.signal?.removeEventListener('abort', onAbort)
      resolve(states)
    }
    const pump = () => {
      // 中断したら、まだ始めていない作業を止める
      if (ctrl.signal.aborted) {
        for (const t of opts.tasks) if (states[t.id].status === 'waiting') states[t.id] = { ...states[t.id], status: 'canceled', error: '止めました。' }
        emit()
      }
      // 前の作業が済まずに終わった作業は blocked にする
      let changed = true
      while (changed) {
        changed = false
        for (const t of opts.tasks) {
          if (states[t.id].status !== 'waiting') continue
          const deps = (t.dependsOn ?? []).map((d) => states[d].status)
          if (deps.some((s) => s === 'failed' || s === 'blocked' || s === 'canceled')) {
            states[t.id] = { ...states[t.id], status: 'blocked', error: '前の作業が終わらなかったため、まだ動かしていません。' }
            changed = true
          }
        }
        if (changed) emit()
      }
      for (const t of opts.tasks) {
        if (active >= limit || ctrl.signal.aborted) break
        const st = states[t.id]
        if (st.status !== 'waiting') continue
        if (!(t.dependsOn ?? []).every((d) => states[d].status === 'done')) continue
        active++
        const resume = st.resume
        set(t.id, { status: 'running', attempts: st.attempts + 1, startedAt: now(), error: undefined, failure: undefined, endedAt: undefined })
        const upstream: Record<string, AgentTaskResult> = {}
        for (const d of t.dependsOn ?? []) { const r = states[d].result; if (r) upstream[d] = r }
        Promise.resolve()
          .then(() => opts.execute(t, { signal: ctrl.signal, upstream, resume }))
          .then(
            (result) => set(t.id, { status: 'done', result, resume: undefined, power: addPower(states[t.id].power, result.power), endedAt: now() }),
            (e) => set(t.id, {
              status: ctrl.signal.aborted ? 'canceled' : 'failed',
              error: failureText(e),
              failure: e instanceof AgentTaskError ? { kind: e.kind, href: e.href?.href, hrefLabel: e.href?.label, cause: e.cause, actions: e.actions } : { kind: 'tool', cause: 'unknown', actions: [{ kind: 'retry', label: 'やり直す' }] },
              resume: e instanceof AgentTaskError && e.resume ? e.resume : resume,
              power: addPower(states[t.id].power, e instanceof AgentTaskError ? e.power : undefined),
              endedAt: now(),
            }),
          )
          .finally(() => { active--; pump() })
      }
      if (active === 0 && opts.tasks.every((t) => states[t.id].status !== 'waiting' && states[t.id].status !== 'running')) finish()
    }
    emit()
    pump()
  })
}
