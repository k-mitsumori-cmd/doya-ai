'use client'
// ============================================
// 経営ホーム「ドヤくんに頼む」（分析 → ゴール・柱・ToDo → まとめて進める）
// ============================================
// 画面の設計: docs/architecture/management-agent/HOME-AGENT-EXPERIENCE-2026-10-25.md（見本 v3）
// 実行の仕組み: docs/architecture/agent-orchestration/DESIGN.md（型の約束は src/lib/agent-orchestration/types.ts）
// - 場面: 入力（続きを進める）→ 質問 → 分析（材料を並べて同時に読む）→ ゴール・柱・ToDo → 確かめ → 実行（3件ずつ同時）→ 完了と記憶
// - 動きは洗練されたものだけ（Animated List・Animated Beam・Border Beam・Number Ticker・Animated Group の動きを CSS で再現）。
//   揺れ・集中線・画面全体の紙吹雪は使わない（2026-10-25 ユーザーの評価）。prefers-reduced-motion では動きを止め、最後の状態を出す
// - 実行は「この内容で進める」を押したあとだけ（承認）。外部への送信・公開はしない（できる物は下書き）
// ⚠️ 実行の仕組みの中身（tools.ts の各ツールの呼び方）を直接使うのは、見本（executor="sample"）のときだけ。
//    本番（executor="api"）は /api/agent/plan と /api/agent/tasks だけを呼ぶ
// ⚠️ 旗（AGENT_ORCHESTRATION_ROLLOUT）と新しい見た目の判定はサーバー（page.tsx）。ここでは判定しない
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AGENT_RECIPES, findRecipe, parseSalesPrepAnswers, sampleAnswers } from '@/lib/agent-orchestration/recipes'
import { planFromRecipe, planTasks, delegatedPower } from '@/lib/agent-orchestration/plan'
import { readSources } from '@/lib/agent-orchestration/sources'
import { runAgentTasks, progressOf, AgentTaskError, type AgentStates, type AgentTaskResult } from '@/lib/agent-orchestration/runner'
import { fakeToolDeps, runSalesPrepTask, type SalesPrepTaskId } from '@/lib/agent-orchestration/tools'
import { todoViews, todoCounts } from '@/lib/agent-orchestration/view'
import type {
  AgentPlan, AgentPlanEvent, AgentPlanRequest, AgentPlanResponse, AgentPlanTask, AgentPowerView, AgentQuestionView, AgentSourceView, AgentTodoView,
  AgentRunCreateRequest, AgentRunView,
} from '@/lib/agent-orchestration/types'
import { readPlanStream } from './stream'
import { AGENT_EXAMPLES } from './examples'
import type { ReactNode } from 'react'
import { HOME_INTENT_GROUPS, matchHomeIntent } from '@/app/(shell)/home/intents'
import styles from './home-agent.module.css'

type Scene = 'input' | 'questions' | 'analyze' | 'plan' | 'confirm' | 'run' | 'done' | 'none'
type Executor = 'api' | 'sample'

const POSE: Record<Scene, string> = {
  input: 'hello', questions: 'point', analyze: 'ponder', plan: 'point', confirm: 'point', run: 'working', done: 'success', none: 'hello',
}
const SAY: Record<Scene, string> = {
  input: '何を進めますか？', questions: '少しだけ教えてください', analyze: '材料を並べて読んでいます', plan: 'ゴールまでの差を分けました',
  confirm: '内容を確かめてください', run: '並べて進めています', done: 'できました。送るのはお願いします', none: 'その依頼は、まだ作戦にできません',
}
const STORE_KEY = 'doya-home-agent:v1'

interface SavedRun {
  recipeId: string
  title: string
  answers: Record<string, string>
  plan: AgentPlan
  delegate: Record<string, boolean>
  states: AgentStates
  savedAt: number
  /** サーバーの実行の記録の id（記録が使える設定のときだけ。AGENT_RUNS_STORE=db） */
  runId?: string
}

/** サーバーの実行の記録を、画面の「前回の作戦の続き」の形にする */
function savedFromRun(r: AgentRunView): SavedRun {
  const delegated = new Set(r.delegated)
  return {
    recipeId: r.recipeId, title: r.title, answers: r.answers, plan: r.plan, states: r.states,
    delegate: Object.fromEntries(planTasks(r.plan).map((t) => [t.id, delegated.has(t.id)])),
    savedAt: Date.parse(r.updatedAt) || Date.now(), runId: r.id,
  }
}

type RunStore = 'unknown' | 'db' | 'off'

/** 続きを読む（記録が使えない設定なら off を返し、画面は端末に残した続きを使う） */
async function readActiveRun(): Promise<{ store: RunStore; saved: SavedRun | null }> {
  try {
    const res = await fetch('/api/agent/runs/active', { cache: 'no-store' })
    if (res.status === 404) return { store: 'off', saved: loadSaved() }
    if (!res.ok) return { store: 'unknown', saved: loadSaved() }
    const data = await res.json().catch(() => null) as { run?: AgentRunView | null } | null
    return { store: 'db', saved: data?.run ? savedFromRun(data.run) : null }
  } catch {
    return { store: 'unknown', saved: loadSaved() }
  }
}

/** 実行の記録を作る。記録を使わない設定（404）なら null */
async function createRun(req: AgentRunCreateRequest): Promise<{ run: AgentRunView | null; off: boolean }> {
  const res = await fetch('/api/agent/runs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(req) })
  if (res.status === 404) return { run: null, off: true }
  const data = await res.json().catch(() => null) as { run?: AgentRunView; error?: string; kind?: AgentTaskError['kind'] } | null
  if (res.status === 201 && data?.run) return { run: data.run, off: false }
  throw new AgentTaskError(data?.error || '作戦を保存できませんでした。時間をおいて、もう一度お試しください。', data?.kind ?? 'tool')
}

/** 記録のある実行で、ToDo を1つ進める（resume はサーバーが持つので送らない） */
async function taskViaRun(runId: string, taskId: string, signal: AbortSignal): Promise<AgentTaskResult> {
  let res: Response
  try {
    res = await fetch(`/api/agent/runs/${encodeURIComponent(runId)}/tasks/${encodeURIComponent(taskId)}`, { method: 'POST', signal })
  } catch (e) {
    if ((e as { name?: string })?.name === 'AbortError') throw e
    throw new AgentTaskError('通信が切れました。もう一度お試しください。')
  }
  const data = await res.json().catch(() => null) as { result?: AgentTaskResult; error?: string; kind?: AgentTaskError['kind']; resume?: Record<string, string>; href?: { href: string; label: string }; power?: AgentTaskError['power'] } | null
  if (res.ok && data?.result) return data.result
  if (res.status === 404) throw new AgentTaskError('この機能は、まだお使いいただけません。', 'auth')
  if (res.status === 429) throw new AgentTaskError(data?.error || '同時に動かせるのは3つまでです。ほかの ToDo が終わってから、やり直してください。', 'limit', data?.resume, data?.href, data?.power)
  // 422 の run は読めないとき入らないことがあるので、画面の今の状態を使う（power だけ受け取る）
  throw new AgentTaskError(data?.error || 'うまく作れませんでした。もう一度お試しください。', data?.kind ?? 'tool', data?.resume, data?.href, data?.power)
}

function loadSaved(): SavedRun | null {
  try {
    const raw = window.localStorage.getItem(STORE_KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as SavedRun
    if (!v || typeof v.savedAt !== 'number' || Date.now() - v.savedAt > 7 * 86400_000 || !findRecipe(v.recipeId) || v.plan?.version !== 2) return null
    return v
  } catch {
    return null
  }
}
function saveRun(run: SavedRun) {
  try { window.localStorage.setItem(STORE_KEY, JSON.stringify(run)) } catch { /* 残せなくても画面は動かす */ }
}

function useReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false)
  useEffect(() => {
    const m = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!m) return
    setReduce(m.matches)
    const on = () => setReduce(m.matches)
    m.addEventListener?.('change', on)
    return () => m.removeEventListener?.('change', on)
  }, [])
  return reduce
}

/** 数を数え上げる（Number Ticker の動き）。動きを減らす設定では最後の値をすぐ出す */
function Ticker({ value, reduce }: { value: number; reduce: boolean }) {
  const [shown, setShown] = useState(reduce ? value : 0)
  const from = useRef(reduce ? value : 0)
  useEffect(() => {
    if (reduce) { setShown(value); from.current = value; return }
    const start = from.current, t0 = performance.now(), ms = 800
    let raf = 0
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ms)
      const v = Math.round(start + (value - start) * (1 - Math.pow(1 - k, 3)))
      setShown(v)
      if (k < 1) raf = requestAnimationFrame(step)
      else from.current = value
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value, reduce])
  return <>{shown.toLocaleString('ja-JP')}</>
}

/** ぼかしから文字が出る1行（Blur Text / Text Effect の動き） */
function BlurLine({ text }: { text: string }) {
  const parts = text.match(/[^、。]+[、。]?/g) ?? [text]
  return <span className={styles.blurline}>{parts.map((w, i) => <span key={i} style={{ animationDelay: `${i * 90}ms` }}>{w}</span>)}</span>
}

const Check = () => (
  <svg className={styles.check} viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5 6.5 12 13 4.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
)
const Bolt = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7z" /></svg>
)

/* ---------- 作戦の取り方（本番は API、見本は手元の部品） ---------- */

async function planViaApi(req: AgentPlanRequest, onEvent: (e: AgentPlanEvent) => void, signal: AbortSignal): Promise<AgentPlanEvent> {
  let res: Response
  try {
    res = await fetch('/api/agent/plan', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/x-ndjson' }, body: JSON.stringify(req), signal })
  } catch (e) {
    if ((e as { name?: string })?.name === 'AbortError') throw e
    return { type: 'error', text: '通信が切れました。もう一度お試しください。' }
  }
  if (res.status === 404) return { type: 'error', text: 'この機能は、まだお使いいただけません。' }
  if (!res.ok || !res.body) return { type: 'error', text: '作戦を作れませんでした。時間をおいて、もう一度お試しください。' }
  return readPlanStream(res.body, onEvent)
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** 見本: 本物の部品（readSources・planFromRecipe）に、見本の読み手を渡す。API も DB も AI も使わない */
async function planViaSample(req: AgentPlanRequest, onEvent: (e: AgentPlanEvent) => void): Promise<AgentPlanEvent> {
  const recipe = findRecipe(req.recipeId) ?? AGENT_RECIPES.find((r) => r.keywords.some((k) => (req.text ?? '').replace(/\s+/g, '').includes(k))) ?? null
  if (!recipe) return { type: 'result', response: { kind: 'none' } }
  const base = { recipeId: recipe.id, title: recipe.title, lead: recipe.lead }
  if (!req.answers) return { type: 'result', response: { kind: 'questions', ...base, questions: recipe.questions } }
  const parsed = parseSalesPrepAnswers(req.answers)
  if (!parsed.ok) return { type: 'result', response: { kind: 'questions', ...base, questions: recipe.questions, error: { questionId: parsed.questionId, text: parsed.error } } }
  const read = await readSources(parsed.value, {
    company: async () => { await wait(900); return '見本株式会社' },
    toolOrgs: async () => { await wait(1500); return { shodan: true, quote: true } },
    power: async () => { await wait(700); return { enabled: true, remaining: 3000, nextRecoveryAt: null } },
  }, (source) => onEvent({ type: 'source', source }))
  const plan = planFromRecipe(recipe, parsed.value, { readiness: read.readiness, companyName: read.companyName })
  for (const text of plan.reasons) { await wait(450); onEvent({ type: 'reason', text }) }
  const ev: AgentPlanEvent = { type: 'result', response: { kind: 'plan', ...base, plan, sources: read.sources, power: read.power, answers: req.answers } }
  onEvent(ev)
  return ev
}

async function taskViaApi(recipeId: string, taskId: string, answers: Record<string, string>, signal: AbortSignal, resume?: Record<string, string>): Promise<AgentTaskResult> {
  let res: Response
  try {
    res = await fetch('/api/agent/tasks', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ recipeId, taskId, answers, resume }), signal })
  } catch (e) {
    if ((e as { name?: string })?.name === 'AbortError') throw e
    throw new AgentTaskError('通信が切れました。もう一度お試しください。')
  }
  const data = await res.json().catch(() => null) as { result?: AgentTaskResult; error?: string; kind?: AgentTaskError['kind']; resume?: Record<string, string>; href?: { href: string; label: string }; power?: AgentTaskError['power'] } | null
  if (res.ok && data?.result) return data.result
  if (res.status === 404) throw new AgentTaskError('この機能は、まだお使いいただけません。', 'auth')
  // 本人ごとに同時に動かせるのは3つまで（それを超えると 429 { kind: 'limit' }）。ほかが終わってからやり直せる
  if (res.status === 429) throw new AgentTaskError(data?.error || '同時に動かせるのは3つまでです。ほかの ToDo が終わってから、やり直してください。', 'limit', data?.resume, data?.href, data?.power)
  // 422 などの答えに付いた power を渡す（渡さないと、量が分からないまま「減っていません」と出てしまう）
  throw new AgentTaskError(data?.error || 'うまく作れませんでした。もう一度お試しください。', data?.kind ?? 'tool', data?.resume, data?.href, data?.power)
}

/* ---------- 本体 ---------- */

export default function HomeAgent({ executor = 'api', greeting, company }: {
  /** sample は見本の結果で最後まで動かす（開発の確認ページ用。API も各ツールも呼ばない） */
  executor?: Executor
  /** 見出しの上のあいさつ（例「おつかれさまです、〇〇さん」）。経営ホームが渡す */
  greeting?: string
  /** 見出しの上の会社の札。経営ホームが渡す */
  company?: ReactNode
}) {
  const reduce = useReducedMotion()
  const [scene, setScene] = useState<Scene>('input')
  // 欄は空で始める（例の文を最初から入れると、書き足したときに後ろへつながってしまう）
  const [text, setText] = useState('')
  const askRef = useRef<HTMLTextAreaElement | null>(null)
  const putExample = (t: string) => { setText(t); requestAnimationFrame(() => askRef.current?.focus()) }
  const [saved, setSaved] = useState<SavedRun | null>(null)
  const [recipeId, setRecipeId] = useState<string>(AGENT_RECIPES[0].id)
  const [title, setTitle] = useState('')
  const [questions, setQuestions] = useState<AgentQuestionView[]>([])
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [qError, setQError] = useState<{ questionId: string; text: string } | null>(null)
  const [sources, setSources] = useState<AgentSourceView[]>([])
  const [reasons, setReasons] = useState<string[]>([])
  const [plan, setPlan] = useState<AgentPlan | null>(null)
  const [power, setPower] = useState<AgentPowerView>({ enabled: false, remaining: null, nextRecoveryAt: null })
  const [delegate, setDelegate] = useState<Record<string, boolean>>({})
  const [states, setStates] = useState<AgentStates>({})
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const ctrl = useRef<AbortController | null>(null)
  const stageRef = useRef<HTMLElement | null>(null)
  const kunRef = useRef<HTMLDivElement | null>(null)
  const sampleDeps = useMemo(() => (executor === 'sample' ? fakeToolDeps({ failSlidesOnce: { done: false } }) : null), [executor])

  // 続き: 本物の API のときは、まずサーバーの実行の記録を読む（記録を使わない設定なら、端末に残したもの）
  const [store, setStore] = useState<RunStore>(executor === 'api' ? 'unknown' : 'off')
  const runIdRef = useRef<string | null>(null)
  const runDelegatedRef = useRef<string[]>([])
  useEffect(() => {
    if (executor !== 'api') { setSaved(loadSaved()); return }
    let live = true
    void readActiveRun().then((r) => { if (live) { setStore(r.store); setSaved(r.saved) } })
    return () => { live = false }
  }, [executor])
  useEffect(() => () => ctrl.current?.abort(), [])
  // ポーズの絵を先に読み込む（切り替えのときに白く抜けない）
  useEffect(() => { for (const p of new Set(Object.values(POSE))) { const im = new Image(); im.src = `/character/${p}-512.webp` } }, [])

  const tasks = useMemo(() => (plan ? planTasks(plan).map((t) => ({ ...t, delegate: delegate[t.id] ?? t.delegate })) : []), [plan, delegate])
  const chosen = useMemo(() => tasks.filter((t) => t.delegate && t.delegable && t.ready.ok), [tasks])
  // まだ済んでいない ToDo（続きを進めるとき、済んだ分は動かさず、量にも数えない）
  const remaining = useMemo(() => chosen.filter((t) => states[t.id]?.status !== 'done'), [chosen, states])
  const total = delegatedPower(remaining)
  const views: AgentTodoView[] = useMemo(() => todoViews(chosen, states, now), [chosen, states, now])
  const counts = todoCounts(views)
  const running = scene === 'run'

  // 動いている間だけ、段の表示を進めるために時刻を更新する
  useEffect(() => {
    if (!running) return
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [running])

  const reset = () => {
    ctrl.current?.abort()
    runIdRef.current = null; runDelegatedRef.current = []
    setSources([]); setReasons([]); setPlan(null); setStates({}); setError(null); setQError(null)
  }

  /** 作戦を取りに行く（質問か作戦か、合わないか） */
  const ask = useCallback(async (req: AgentPlanRequest) => {
    ctrl.current?.abort()
    const c = new AbortController()
    ctrl.current = c
    setError(null)
    setSources([]); setReasons([])
    const onEvent = (e: AgentPlanEvent) => {
      if (c.signal.aborted) return
      if (e.type === 'source') setSources((cur) => { const i = cur.findIndex((s) => s.id === e.source.id); if (i < 0) return [...cur, e.source]; const n = cur.slice(); n[i] = e.source; return n })
      if (e.type === 'reason') setReasons((cur) => [...cur, e.text])
    }
    if (req.answers) setScene('analyze')
    const t0 = Date.now()
    let last: AgentPlanEvent
    try {
      last = executor === 'sample' ? await planViaSample(req, onEvent) : await planViaApi(req, onEvent, c.signal)
    } catch {
      return
    }
    if (c.signal.aborted) return
    // 分析は最短1.5秒は見せる（一瞬で消えると、何が起きたか分からないため）
    if (req.answers && !reduce) { const left = 1500 - (Date.now() - t0); if (left > 0) await wait(left) }
    if (last.type === 'error') { setError(last.text); setScene(req.answers ? 'questions' : 'input'); return }
    if (last.type !== 'result') return
    const r: AgentPlanResponse = last.response
    if (r.kind === 'none') { setScene('none'); return }
    setRecipeId(r.recipeId); setTitle(r.title)
    if (r.kind === 'questions') {
      setQuestions(r.questions)
      setAnswers((cur) => (Object.keys(cur).length ? cur : sampleAnswers(findRecipe(r.recipeId) ?? AGENT_RECIPES[0])))
      setQError(r.error ?? null)
      setScene('questions')
      return
    }
    setPlan(r.plan); setSources(r.sources); setPower(r.power); setAnswers(r.answers)
    setDelegate(Object.fromEntries(r.plan.pillars.flatMap((p) => p.tasks).map((t) => [t.id, t.delegate])))
    setScene('plan')
  }, [executor, reduce])

  const send = () => { reset(); void ask({ text: text.trim() }) }
  const submitAnswers = () => { void ask({ recipeId, answers }) }

  /** ToDo をまとめて進める（prev があれば、済んだ分を残して残りだけ） */
  const run = useCallback(async (prev?: AgentStates) => {
    if (!plan) return
    ctrl.current?.abort()
    const c = new AbortController()
    ctrl.current = c
    setScene('run')
    // 記録が使える設定なら、実行の記録を作ってから進める（任せる ToDo が変わったら、作り直す）
    let useStore = executor === 'api' && store !== 'off'
    if (useStore) {
      const ids = chosen.map((t) => t.id)
      const same = runIdRef.current && ids.every((id) => runDelegatedRef.current.includes(id))
      if (!same) {
        try {
          const made = await createRun({ recipeId, answers, delegate: ids, text: title })
          if (made.off) { setStore('off'); useStore = false }
          else if (made.run) { runIdRef.current = made.run.id; runDelegatedRef.current = made.run.delegated; setStore('db') }
        } catch (e) {
          if (c.signal.aborted) return
          setError(e instanceof AgentTaskError ? e.userMessage : '作戦を保存できませんでした。時間をおいて、もう一度お試しください。')
          setScene('plan')
          return
        }
      }
    }
    if (c.signal.aborted) return
    const runId = useStore ? runIdRef.current : null
    const execute = (t: AgentPlanTask, ctx: { signal: AbortSignal; resume?: Record<string, string> }) =>
      executor === 'sample' && sampleDeps
        ? (() => { const p = parseSalesPrepAnswers(answers); if (!p.ok) throw new AgentTaskError(p.error, 'input'); return runSalesPrepTask(t.id as SalesPrepTaskId, p.value, sampleDeps, ctx.resume) })()
        : runId ? taskViaRun(runId, t.id, ctx.signal)
        : taskViaApi(recipeId, t.id, answers, ctx.signal, ctx.resume)
    const final = await runAgentTasks({
      tasks: chosen,
      execute,
      concurrency: plan.concurrency,
      prev,
      signal: c.signal,
      onChange: (s) => {
        setStates(s)
        // 記録があるときはサーバーが残す。無いときだけ端末に残す
        if (!runId) saveRun({ recipeId, title, answers, plan, delegate, states: s, savedAt: Date.now() })
      },
    })
    if (c.signal.aborted) return
    setStates(final)
    if (progressOf(final).finished) setScene('done')
  }, [plan, chosen, executor, sampleDeps, answers, recipeId, title, delegate, store])

  /** 入力に戻るとき、続きを読み直す（記録があればサーバーから、無ければ端末から） */
  const refreshSaved = () => {
    if (executor === 'api' && store !== 'off') { void readActiveRun().then((r) => { setStore(r.store); setSaved(r.saved) }); return }
    setSaved(loadSaved())
  }

  /** 続きを進める（残っている ToDo から） */
  const resume = (s: SavedRun) => {
    reset()
    setRecipeId(s.recipeId); setTitle(s.title); setAnswers(s.answers); setPlan(s.plan); setDelegate(s.delegate); setStates(s.states)
    if (s.runId) { runIdRef.current = s.runId; runDelegatedRef.current = Object.entries(s.delegate).filter(([, v]) => v).map(([k]) => k) }
    setScene('plan')
  }

  // 材料からドヤくんへ光が流れる線（Animated Beam）。1280px かつ動きを減らす設定でないときだけ
  const [beams, setBeams] = useState<{ id: string; d: string; reading: boolean }[]>([])
  useEffect(() => {
    if (scene !== 'analyze' || reduce) { setBeams([]); return }
    const measure = () => {
      const st = stageRef.current, k = kunRef.current
      if (!st || !k || window.innerWidth <= 860) { setBeams([]); return }
      const s = st.getBoundingClientRect(), kr = k.getBoundingClientRect()
      const x2 = kr.right - s.left - 24, y2 = kr.top - s.top + kr.height / 2
      setBeams(sources.map((src) => {
        const el = st.querySelector<HTMLElement>(`[data-src="${src.id}"]`)
        if (!el) return null
        const c = el.getBoundingClientRect()
        const x1 = c.left - s.left, y1 = c.top - s.top + c.height / 2, mx = (x1 + x2) / 2
        return { id: src.id, d: `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`, reading: src.status === 'reading' }
      }).filter((b): b is { id: string; d: string; reading: boolean } => Boolean(b)))
    }
    const raf = requestAnimationFrame(measure)
    window.addEventListener('resize', measure)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', measure) }
  }, [scene, sources, reduce])

  const readCount = sources.filter((s) => s.status !== 'reading').length
  const pose = POSE[scene]

  return (
    <section ref={stageRef} className={styles.stage} data-scene={scene} data-reduce={reduce ? 'true' : undefined} aria-labelledby="home-agent-title" aria-live="polite">
      {beams.length ? (
        <svg className={styles.beams} aria-hidden="true">
          <defs>
            <linearGradient id="ha-beam" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#0066ff" stopOpacity="0" /><stop offset=".5" stopColor="#00d4ff" /><stop offset="1" stopColor="#0066ff" stopOpacity="0" /></linearGradient>
          </defs>
          {beams.map((b, i) => (
            <g key={b.id}>
              <path d={b.d} className={styles.beamTrack} />
              {b.reading ? <path d={b.d} className={styles.beamFlow} style={{ animationDelay: `${i * 120}ms` }} /> : null}
            </g>
          ))}
        </svg>
      ) : null}

      {/* 見出しは「今日は、何をしますか？」の1つだけ（旧の欄と新しい欄をまとめた。2026-10-26 ユーザーの指示）。
          入力の画面では大きく出し、ほかの画面では読み上げ用だけにする */}
      <header className={scene === 'input' ? styles.head : styles.srOnly}>
        {greeting ? <p className={styles.headGreeting}>{greeting}</p> : null}
        {company ? <div className={styles.headCompany}>{company}</div> : null}
        <h1 id="home-agent-title" className={styles.headTitle}>今日は、何をしますか？</h1>
      </header>

      <div className={styles.hero}>
        <div className={styles.kun} ref={kunRef}>
          <span className={styles.halo} aria-hidden="true" />
          {/* 2枚を重ねて、ふわっと入れ替える（Object.values の並びで固定） */}
          {Array.from(new Set(Object.values(POSE))).map((p) => (
            <img key={p} src={`/character/${p}-512.webp`} alt={p === pose ? 'ドヤくん' : ''} aria-hidden={p === pose ? undefined : true}
              width={512} height={512} className={styles.pose} data-on={p === pose ? 'true' : undefined} />
          ))}
        </div>
        <p className={styles.say}>{SAY[scene]}</p>
      </div>

      <div className={styles.panel}>

        {scene === 'input' ? (
          <div className={styles.sceneIn}>
            <div className={styles.card}>
              <textarea id="home-agent-ask" aria-labelledby="home-agent-title" aria-describedby="home-agent-lead" ref={askRef} className={styles.textarea} value={text} onChange={(e) => setText(e.target.value)} rows={3}
                placeholder="例: 来週の商談の準備をまとめて進めたい" />
              <p id="home-agent-lead" className={styles.lead}>やりたいことやゴールを書くと、ドヤくんが材料を読み、ゴールまでの差を ToDo に分けます。動かす前に、内容と減る量を確かめます。</p>
              <p className={styles.chipsLabel}>例を押すと、欄に入ります</p>
              <div className={`${styles.chips} ${styles.exampleChips}`}>
                {AGENT_EXAMPLES.map((t) => <button key={t} type="button" className={styles.chip} aria-pressed={text === t} onClick={() => putExample(t)}>{t}</button>)}
              </div>
              {error ? <p className={styles.error} role="alert">{error}</p> : null}
              <div className={styles.row}>
                <span className={styles.muted}>作戦づくりでは、ドヤパワーは減りません</span>
                <button type="button" className={styles.btn} onClick={send} disabled={!text.trim()}>分析して作戦を立てる</button>
              </div>
            </div>
            {/* 新しい依頼を先に置き、前回の続きはその下にする（主な操作はゴールを書くこと。2026-10-26 統括の点検で、続きが上だと欄が 375px で y=507 まで下がっていた） */}
            {saved ? <ResumeCard saved={saved} onResume={() => resume(saved)} /> : null}
            <ToolShortcuts />
          </div>
        ) : null}

        {scene === 'none' ? (
          <div className={`${styles.card} ${styles.sceneIn}`}>
            <p className={styles.title}>その依頼は、まだ作戦にできません</p>
            <p className={styles.lead}>今は「{AGENT_RECIPES.map((r) => r.chip).join('」「')}」のような依頼を、作戦に分けられます。{matchHomeIntent(text) ? 'この依頼は、次のツールで進められます。' : 'ほかの依頼は、各ツールで進められます。'}</p>
            <div className={styles.row}>
              {matchHomeIntent(text) ? <Link href={matchHomeIntent(text)!.href} className={styles.btn}>{matchHomeIntent(text)!.label.replace(/たい$/, 'る')}</Link> : <span />}
              <button type="button" className={`${styles.btn} ${styles.ghost}`} onClick={() => setScene('input')}>依頼を書き直す</button>
            </div>
          </div>
        ) : null}

        {scene === 'questions' ? (
          <div className={`${styles.card} ${styles.sceneIn}`}>
            <p className={styles.eyebrow}>{title}</p>
            <p className={styles.title}>作戦を立てる前に、少しだけ教えてください</p>
            <div className={styles.questions}>
              {questions.map((q) => (
                <div key={q.id} className={styles.question}>
                  <label htmlFor={`ha-q-${q.id}`} className={styles.qLabel}>{q.label}</label>
                  {q.kind === 'choice' && q.options ? (
                    <div className={styles.options} role="radiogroup" aria-label={q.label}>
                      {q.options.map((o) => (
                        <label key={o.value} className={styles.option} data-on={answers[q.id] === o.value ? 'true' : undefined}>
                          <input type="radio" name={`ha-q-${q.id}`} id={o.value === q.options![0].value ? `ha-q-${q.id}` : undefined} value={o.value} checked={answers[q.id] === o.value} onChange={() => setAnswers((a) => ({ ...a, [q.id]: o.value }))} />
                          {o.label}
                        </label>
                      ))}
                    </div>
                  ) : (
                    <input id={`ha-q-${q.id}`} className={styles.input} value={answers[q.id] ?? ''} placeholder={q.placeholder} onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))} inputMode={q.id === 'url' ? 'url' : undefined} />
                  )}
                  {q.help ? <p className={styles.help}>{q.help}</p> : null}
                  {qError?.questionId === q.id ? <p className={styles.error} role="alert">{qError.text}</p> : null}
                </div>
              ))}
            </div>
            {error ? <p className={styles.error} role="alert">{error}</p> : null}
            <div className={styles.row}>
              <button type="button" className={`${styles.btn} ${styles.ghost}`} onClick={() => setScene('input')}>戻る</button>
              <button type="button" className={styles.btn} onClick={submitAnswers}>分析して作戦を立てる</button>
            </div>
          </div>
        ) : null}

        {scene === 'analyze' ? (
          <div className={`${styles.card} ${styles.sceneIn}`}>
            <div className={styles.row}>
              <div><p className={styles.eyebrow}>分析しています</p><p className={styles.title}>{title || '作戦の材料を読んでいます'}</p></div>
              <span className={styles.muted}>{readCount} / {Math.max(sources.length, 1)} 件</span>
            </div>
            <ul className={styles.sources}>
              {sources.map((s) => (
                <li key={s.id} data-src={s.id} className={styles.src} data-status={s.status}>
                  <span className={styles.sicon} aria-hidden="true">{SOURCE_ICON[s.kind]}</span>
                  <span className={styles.srcBody}>
                    <b>{s.label}</b>
                    <span className={styles.muted}>{s.note ?? '読んでいます'}</span>
                    <span className={styles.sbar}><i /></span>
                  </span>
                  <span className={styles.sstate}>{s.status === 'read' ? <><Check />読みました</> : s.status === 'skipped' ? '使いません' : '読んでいます'}</span>
                </li>
              ))}
            </ul>
            <div className={styles.thought}>{reasons.map((r, i) => <BlurLine key={i} text={r} />)}</div>
          </div>
        ) : null}

        {(scene === 'plan' || scene === 'confirm') && plan ? (
          <PlanView plan={plan} tasks={tasks} states={states} total={total} chosen={remaining.length} power={power} reduce={reduce}
            confirm={scene === 'confirm'}
            onToggle={(id, v) => setDelegate((d) => ({ ...d, [id]: v }))}
            onGo={() => setScene('confirm')}
            onBack={() => setScene('plan')}
            onRun={() => void run(Object.keys(states).length ? states : undefined)} />
        ) : null}

        {(scene === 'run' || scene === 'done') && plan ? (
          <div className={styles.sceneIn}>
            <div className={styles.card}>
              <div className={styles.row}>
                <div>
                  <p className={styles.eyebrow}>{scene === 'done' ? 'できました' : '並べて進めています'}</p>
                  <p className={styles.title}>{scene === 'done' ? `${counts.done}件の ToDo が終わりました` : `${plan.concurrency}件ずつ同時に進めています`}</p>
                </div>
                <span className={styles.muted}>{counts.done} / {counts.total} 件</span>
              </div>
              <ul className={styles.runs}>
                {views.map((v) => {
                  const t = chosen.find((x) => x.id === v.id)!
                  return (
                    <li key={v.id} className={styles.run} data-status={v.status}>
                      <span className={styles.ticon} aria-hidden="true">{TOOL_ICON[t.tool] ?? TOOL_ICON.default}</span>
                      <span className={styles.srcBody}>
                        <b>{t.title}</b>
                        <span className={styles.muted}>
                          {v.status === 'running' ? t.stages[v.stage ?? 0] : v.status === 'done' ? v.draft?.summary : v.status === 'failed' ? v.error?.text : `${t.toolName}・約${t.minutes}分`}
                        </span>
                        {v.status === 'done' && v.draft ? <Link href={v.draft.href} className={styles.link}>{v.draft.hrefLabel}</Link> : null}
                        {v.status === 'failed' && v.error?.href ? <Link href={v.error.href} className={styles.link}>{v.error.hrefLabel ?? '開く'}</Link> : null}
                        {v.status === 'failed' && failPowerText(v) ? <span className={styles.muted}>{failPowerText(v)}</span> : null}
                      </span>
                      <span className={styles.rstate}>
                        {v.status === 'done' ? <><Check />できた</> : v.status === 'running' ? '進めています' : v.status === 'failed' ? '作れませんでした' : '待っています'}
                      </span>
                    </li>
                  )
                })}
              </ul>
              {scene === 'done' && counts.failed ? (
                <div className={styles.row}>
                  <span className={styles.muted}>やり直すと、失敗した ToDo だけをもう一度進めます。</span>
                  <button type="button" className={styles.btn} onClick={() => void run(states)}>残りをやり直す</button>
                </div>
              ) : null}
            </div>
            {scene === 'done' ? (
              <div className={styles.memory}>
                <b>作戦に残しました</b>
                <span>ゴール・3つの柱と、できた下書きを、この作戦に残しました。次に経営ホームを開くと「続きを進める」から再開できます。送る・公開する操作は、各ツールで内容を確かめてから行ってください。</span>
                <button type="button" className={`${styles.btn} ${styles.ghost}`} onClick={() => { reset(); setText(''); refreshSaved(); setScene('input') }}>経営ホームの入力に戻る</button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  )
}

/* ---------- ゴール → 柱 → ToDo と、確かめ ---------- */

function PlanView({ plan, tasks, states, total, chosen, power, reduce, confirm, onToggle, onGo, onBack, onRun }: {
  plan: AgentPlan
  tasks: (AgentPlanTask & { dependsOn: string[] })[]
  states: AgentStates
  total: number
  chosen: number
  power: AgentPowerView
  reduce: boolean
  confirm: boolean
  onToggle: (id: string, v: boolean) => void
  onGo: () => void
  onBack: () => void
  onRun: () => void
}) {
  const g = plan.goal
  const byId = new Map(tasks.map((t) => [t.id, t]))
  const short = power.enabled && power.remaining !== null && power.remaining < total
  if (confirm) {
    return (
      <div className={`${styles.card} ${styles.confirm} ${styles.sceneIn}`}>
        <p className={styles.eyebrow}>動かす前に確かめます</p>
        <p className={styles.title}>{chosen}件の ToDo を、ドヤくんに任せますか？</p>
        <dl className={styles.calc}>
          <dt>合計で減るドヤパワー</dt><dd>{total.toLocaleString('ja-JP')}</dd>
          {power.enabled && power.remaining !== null ? (<><dt>今の残り</dt><dd>{power.remaining.toLocaleString('ja-JP')}</dd><dt>動かしたあとの残り</dt><dd>{Math.max(0, power.remaining - total).toLocaleString('ja-JP')}</dd></>) : null}
        </dl>
        <ul className={styles.uses}>{tasks.filter((t) => t.delegate && t.delegable && t.ready.ok && states[t.id]?.status !== 'done').map((t) => <li key={t.id}>{t.toolName}: {t.uses}</li>)}</ul>
        {short ? <p className={styles.error} role="alert">ドヤパワーが足りません。任せる ToDo を減らすか、回復を待ってください。</p> : null}
        <p className={styles.muted}>できる物はすべて下書きです。送る・公開する操作は、内容を確かめてから、あなたが行います。失敗した ToDo は、減った分を戻します。</p>
        <div className={styles.row}>
          <button type="button" className={`${styles.btn} ${styles.ghost}`} onClick={onBack}>選び直す</button>
          <button type="button" className={styles.btn} onClick={onRun} disabled={short || chosen === 0}>この内容で進める</button>
        </div>
      </div>
    )
  }
  return (
    <div className={styles.sceneIn}>
      <div className={`${styles.card} ${styles.group}`} style={{ animationDelay: '0ms' }}>
        <p className={styles.eyebrow}>ゴール（{g.period}）</p>
        <p className={styles.title}>{g.statement}</p>
        <dl className={styles.gap}>
          <div><dt>今</dt><dd><Ticker value={g.now} reduce={reduce} /><small>{g.unit}</small></dd></div>
          <div><dt>ゴール</dt><dd><Ticker value={g.target} reduce={reduce} /><small>{g.unit}</small></dd></div>
          <div><dt>差</dt><dd className={styles.accent}><Ticker value={g.gap} reduce={reduce} /><small>{g.unit}</small></dd></div>
        </dl>
        <p className={styles.muted}>{g.measure}の差を埋めるために、{plan.pillars.length}つの柱と{tasks.length}件の ToDo に分けました。どの ToDo も、このゴールにつながっています。</p>
      </div>
      <div className={styles.tree}>
        {plan.pillars.map((p, pi) => (
          <section key={p.id} className={`${styles.pillar} ${styles.group}`} style={{ animationDelay: `${(pi + 1) * 160}ms` }}>
            <header className={styles.pillarHead}><h3>{p.name}</h3><span className={styles.muted}>{p.teamGoal}</span></header>
            <p className={styles.muted}>{p.why}</p>
            <ul className={styles.todos}>
              {p.tasks.map((raw) => {
                const t = byId.get(raw.id) ?? { ...raw, dependsOn: raw.after }
                const done = states[t.id]?.status === 'done'
                const can = t.delegable && t.ready.ok && !done
                return (
                  <li key={t.id} className={styles.todo} data-off={!t.delegate || !can ? 'true' : undefined}>
                    <span className={styles.ticon} aria-hidden="true">{TOOL_ICON[t.tool] ?? TOOL_ICON.default}</span>
                    <span className={styles.srcBody}>
                      <b>{t.title}</b>
                      <span className={styles.muted}>{t.toolName}・約{t.minutes}分・{t.makes}</span>
                      {!t.ready.ok ? <span className={styles.notice}>{t.ready.reason}{t.ready.href ? <> <Link href={t.ready.href} className={styles.link}>{t.ready.hrefLabel ?? '開く'}</Link></> : null}</span> : null}
                    </span>
                    <span className={styles.todoRight}>
                      {t.power > 0 ? <span className={styles.cost}><Bolt />{t.power}</span> : null}
                      {done ? <span className={styles.rstate}><Check />済み</span> : (
                        <label className={styles.ask}>
                          <input type="checkbox" checked={Boolean(t.delegate) && can} disabled={!can} onChange={(e) => onToggle(t.id, e.target.checked)} />
                          ドヤくんに任せる
                        </label>
                      )}
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
      <div className={`${styles.total} ${styles.group}`} style={{ animationDelay: `${(plan.pillars.length + 1) * 160}ms` }}>
        <span className={styles.muted}>任せる ToDo で <strong className={styles.sum}><Ticker value={total} reduce={reduce} /></strong> 減ります{power.enabled && power.remaining !== null ? `（今の残り ${power.remaining.toLocaleString('ja-JP')}）` : ''}</span>
        <button type="button" className={styles.btn} onClick={onGo} disabled={chosen === 0}>{chosen === 0 && tasks.some((t) => states[t.id]?.status === 'done') ? 'すべて済んでいます' : 'まとめて進める'}</button>
      </div>
    </div>
  )
}

/** ツールですぐ始める（経営ホームから、各ツールの主な操作へ1回で移る。区分ごとに2つずつ） */
function ToolShortcuts() {
  const items = HOME_INTENT_GROUPS.flatMap((g) => g.intents.slice(0, 2).map((i) => ({ ...i, group: g.label })))
  return (
    <nav className={styles.card} aria-labelledby="home-agent-tools">
      <p className={styles.eyebrow}>ツールですぐ始める</p>
      <p id="home-agent-tools" className={styles.title}>よく使う操作</p>
      <ul className={styles.shortcuts}>
        {items.map((i) => (
          <li key={i.href}><Link href={i.href} className={styles.shortcut}><span className={styles.muted}>{i.group}</span><b>{i.label}</b></Link></li>
        ))}
      </ul>
    </nav>
  )
}

/**
 * 失敗した ToDo のドヤパワーの一文（DESIGN.md §3.5 の順）。
 * 量が分からない（通信が切れた）ときは言わない。used と refunded は減る量の表から数えた目安
 */
function failPowerText(v: AgentTodoView): string | null {
  if (!v.powerKnown) return null
  if (v.power.used > 0) return `ドヤパワーが ${v.power.used} 減りました（途中まで作れた分）。`
  if (v.power.refunded > 0) return `減ったドヤパワー（${v.power.refunded}）は戻しました。`
  return 'ドヤパワーは減っていません。'
}

/** 前回の作戦の続き。残っている ToDo を並べ、そこから再開する */
function ResumeCard({ saved, onResume }: { saved: SavedRun; onResume: () => void }) {
  const p = progressOf(saved.states)
  const left = planTasks(saved.plan)
    .filter((t) => (saved.delegate[t.id] ?? t.delegate) && saved.states[t.id]?.status !== 'done')
  const shown = left.slice(0, 4)
  return (
    <div className={styles.resume}>
      <div className={styles.resumeHead}>
        <ProgressRing done={p.done} total={p.total} />
        <span className={styles.resumeText}>
          <span className={styles.muted}>前回の作戦の続き</span>
          <b>{saved.plan.goal.statement}</b>
          <span className={styles.muted}>ToDo {p.done} / {p.total} 件が完了</span>
        </span>
      </div>
      {shown.length ? (
        <ul className={styles.resumeList} aria-label="残っている ToDo">
          {shown.map((t) => (
            <li key={t.id}>
              <span>{t.title}</span>
              <span className={styles.resumeState} data-status={saved.states[t.id]?.status ?? 'queued'}>
                {saved.states[t.id]?.status === 'failed' ? 'やり直し待ち' : 'まだ'}
              </span>
            </li>
          ))}
          {left.length > shown.length ? <li className={styles.muted}>ほか {left.length - shown.length} 件</li> : null}
        </ul>
      ) : null}
      <button type="button" className={styles.btn} onClick={onResume}>
        {left.length ? `残り ${left.length} 件を進める` : '作戦を見る'}
      </button>
    </div>
  )
}

function ProgressRing({ done, total }: { done: number; total: number }) {
  const c = 113, off = total ? c * (1 - done / total) : c
  return (
    <svg className={styles.ring} viewBox="0 0 44 44" aria-hidden="true">
      <circle cx="22" cy="22" r="18" fill="none" stroke="var(--blue-soft)" strokeWidth="5" />
      <circle cx="22" cy="22" r="18" fill="none" stroke="var(--blue)" strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} transform="rotate(-90 22 22)" />
    </svg>
  )
}

const svgI = (d: string) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
)
const SOURCE_ICON: Record<AgentSourceView['kind'], JSX.Element> = {
  request: svgI('M4 5h16v10H8l-4 4z'),
  company: svgI('M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M16 9h2a2 2 0 0 1 2 2v10M8 7h4M8 11h4M8 15h4M3 21h18'),
  tools: svgI('M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18v3h3l6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z'),
  power: svgI('M13 2 4 14h7l-1 8 9-12h-7z'),
  history: svgI('M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2'),
}
const TOOL_ICON: Record<string, JSX.Element> = {
  shodan: svgI('M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M16 9h2a2 2 0 0 1 2 2v10M3 21h18'),
  quote: svgI('M6 3h9l3 3v15H6zM9 9h6M9 13h6M9 17h4'),
  doyaslide: svgI('M3 4h18v12H3zM12 16v4M8 20h8'),
  default: svgI('M4 4h16v16H4z'),
}
