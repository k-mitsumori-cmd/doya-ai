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
import { useRouter } from 'next/navigation'
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
import { AGENT_EXAMPLES, agentPlansForDepartment, intentsOfDepartment } from './examples'
import type { ReactNode } from 'react'
import { HOME_INTENT_GROUPS, matchHomeIntent } from '@/app/(shell)/home/intents'
import { normalizeValue, stashPrefill, withPrefillKey } from '@/lib/agent-router/prefill'
import type { AgentField, AgentRouteResponse } from '@/lib/agent-router/types'
import { useToolHref } from '@/components/shell/ui-next-context'
import type { DepartmentId } from '@/lib/departments'
import { TypewriterTextarea } from './TypewriterTextarea'
import styles from './home-agent.module.css'
import { RevealWords } from '@/components/ds/motion'

type Scene = 'input' | 'fill' | 'questions' | 'analyze' | 'plan' | 'confirm' | 'run' | 'done' | 'none'
type Executor = 'api' | 'sample'

const POSE: Record<Scene, string> = {
  // 小さく（72px 以下）表示するので、飾りを減らした mini-* の絵を使う（2026-10-29 Codex の画像生成）
  input: 'hello', fill: 'mini-point', questions: 'mini-point', analyze: 'ponder', plan: 'mini-point', confirm: 'mini-point', run: 'mini-working', done: 'success', none: 'mini-hello',
}
const SAY: Record<Scene, string> = {
  input: '何を頼みますか？', fill: 'あと少しだけ教えてください', questions: '少しだけ教えてください', analyze: '材料を並べて読んでいます', plan: 'ゴールまでの差を分けました',
  confirm: '内容を確かめてください', run: '並べて進めています', done: 'できました。送るのはお願いします', none: 'その依頼は、ツールの画面で進めます',
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
/** その日の最初の表示だけフルに動かし、2回目以降は短くする（端末の日付で決める。開くたびに1回だけ読む） */
let dayMotionCache: 'full' | 'short' | null = null
function readDayMotion(): 'full' | 'short' {
  if (dayMotionCache) return dayMotionCache
  let mode: 'full' | 'short' = 'full'
  try {
    const d = new Date()
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    mode = window.localStorage.getItem('doya-home-agent-motion-day') === today ? 'short' : 'full'
    window.localStorage.setItem('doya-home-agent-motion-day', today)
  } catch { /* 読めなければフル */ }
  dayMotionCache = mode
  return mode
}

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

export default function HomeAgent({ executor = 'api', greeting, company, dept = null }: {
  /** sample は見本の結果で最後まで動かす（開発の確認ページ用。API も各ツールも呼ばない） */
  executor?: Executor
  /** 見出しの上のあいさつ（例「おつかれさまです、〇〇さん」）。経営ホームが渡す */
  greeting?: string
  /** 見出しの上の会社の札。経営ホームが渡す */
  company?: ReactNode
  /** 経営ホームで選んでいる部署（旗 DEPARTMENTS_ROLLOUT が on のときだけ渡される。null は「すべて」）。セールス以外の部署では依頼の欄の代わりに道具へのリンクを出す（examples.ts） */
  dept?: DepartmentId | null
}) {
  const toHref = useToolHref()
  const router = useRouter()
  // 「ドヤAIに頼む」: AI が依頼を読み、ツールと操作を選ぶ（/api/agent/route）。読んでいる間・画面を開いている間の表示
  const [opening, setOpening] = useState<string | null>(null)
  // 選ばれた操作と、まだ足りない値を1つずつ聞く画面（fill）の状態
  const [route, setRoute] = useState<Extract<AgentRouteResponse, { kind: 'action' }> | null>(null)
  const [fillIndex, setFillIndex] = useState(0)
  const [fillValue, setFillValue] = useState('')
  const [fillError, setFillError] = useState<string | null>(null)
  // どれにも合わなかったときの、近い操作の案（行き止まりにしない）
  const [suggest, setSuggest] = useState<{ reason: string; links: { label: string; href: string }[] } | null>(null)
  const toolsOnly = !agentPlansForDepartment(dept)
  const reduce = useReducedMotion()
  const [scene, setScene] = useState<Scene>('input')
  // 欄は空で始める（例の文を最初から入れると、書き足したときに後ろへつながってしまう）
  const [text, setText] = useState('')
  const askRef = useRef<HTMLTextAreaElement | null>(null)
  // 書くと入力欄が自動で伸びる（最低4行は CSS の min-height）
  useEffect(() => {
    const el = askRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [text])
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
  const [dayMotion, setDayMotion] = useState<'full' | 'short'>('full')
  useEffect(() => { setDayMotion(readDayMotion()) }, [])
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

  /** 選んだ操作の画面を、値を入れた状態で開く（保存・送信は、開いた画面で本人が押す） */
  const openAction = (path: string, values: Record<string, string>, label: string) => {
    setOpening(`「${label}」の画面を開いています…`)
    // 値は URL に載せない。同じタブの sessionStorage に入れ、URL には一度きりの鍵だけを付ける（2026-10-29 統括の監査 中1）
    let storage: Storage | null = null
    try { storage = window.sessionStorage } catch { storage = null }
    router.push(toHref(withPrefillKey(path, stashPrefill(values, storage))))
    // 移れなかったとき（通信の切れなど）に「開いています」のまま止まらないよう、少し待って元に戻す
    window.setTimeout(() => setOpening(null), 8000)
  }

  /**
   * 「ドヤAIに頼む」（2026-10-28 本人の指示）。AI が依頼を読み、全ツールの中からツールと操作を選ぶ。
   * - 1つの操作で済む → 足りない値を1つずつ聞いてから、値を入れた画面を開く
   * - 複数の手順が要る → 今までの作戦づくり（ask）へ
   * - どれにも合わない → 近い操作の案を出す（行き止まりにしない）
   * 見本（executor="sample"）と、API が無い（旗が off で 404）ときは、今までの作戦づくりだけを使う
   */
  const send = async () => {
    const t = text.trim()
    if (!t || opening) return
    if (executor !== 'api') { reset(); void ask({ text: t }); return }
    setOpening('ドヤAIが、依頼を読んでいます…'); setError(null); setSuggest(null)
    let data: AgentRouteResponse | null = null
    try {
      const res = await fetch('/api/agent/route', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: t }) })
      if (res.status === 404) { setOpening(null); reset(); void ask({ text: t }); return }
      data = res.ok ? ((await res.json()) as AgentRouteResponse) : null
    } catch {
      data = null
    }
    setOpening(null)
    if (!data) { setError('依頼を読めませんでした。時間をおいて、もう一度お試しください。'); return }
    if (data.kind === 'action') {
      if (data.missing.length) { setRoute(data); setFillIndex(0); setFillValue(''); setFillError(null); setScene('fill'); return }
      openAction(data.href, data.values, data.action.label)
      return
    }
    if (data.kind === 'plan') { reset(); void ask({ recipeId: data.planId }); return }
    setSuggest({ reason: data.reason, links: data.kind === 'unknown' ? data.suggestions : [] })
    setScene('none')
  }

  /** 足りない値を1つ受け取り、次を聞くか、画面を開く */
  const fillNext = () => {
    if (!route) return
    const field = route.missing[fillIndex]
    if (!field) return
    const v = normalizeValue(field.type, fillValue)
    if (!v) { setFillError(fillHelp(field)); return }
    const values = { ...route.values, [field.key]: v }
    if (fillIndex + 1 < route.missing.length) {
      setRoute({ ...route, values }); setFillIndex(fillIndex + 1); setFillValue(''); setFillError(null)
      return
    }
    openAction(route.href, values, route.action.label)
  }
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
  const [beams, setBeams] = useState<{ id: string; d: string; reading: boolean; end: { x: number; y: number } }[]>([])
  useEffect(() => {
    if (scene !== 'analyze' || reduce) { setBeams([]); return }
    const measure = () => {
      const st = stageRef.current, k = kunRef.current
      if (!st || !k || window.innerWidth <= 860) { setBeams([]); return }
      const s = st.getBoundingClientRect(), kr = k.getBoundingClientRect()
      // 小さなクマは見出しの右にある。材料の行から、クマの下の真ん中へ、光の線を引く
      const x2 = kr.left - s.left + kr.width / 2, y2 = kr.bottom - s.top - 6
      setBeams(sources.map((src) => {
        const el = st.querySelector<HTMLElement>(`[data-src="${src.id}"]`)
        if (!el) return null
        const c = el.getBoundingClientRect()
        // 行の右の端から出て、上へ曲がってクマの足もとに着く（行は横いっぱいなので、クマに近い右の端から引くと線が長く見える）
        const x1 = c.right - s.left - 14, y1 = c.top - s.top + c.height / 2
        return { id: src.id, d: `M${x1},${y1} C${x1},${y1 - 56} ${x2},${y2 + 56} ${x2},${y2}`, reading: src.status === 'reading', end: { x: x2, y: y2 } }
      }).filter((b): b is { id: string; d: string; reading: boolean; end: { x: number; y: number } } => Boolean(b)))
    }
    const raf = requestAnimationFrame(measure)
    window.addEventListener('resize', measure)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', measure) }
  }, [scene, sources, reduce])

  const readCount = sources.filter((s) => s.status !== 'reading').length
  const pose = POSE[scene]

  return (
    <section ref={stageRef} className={styles.stage} data-scene={scene} data-motion={dayMotion} data-reduce={reduce ? 'true' : undefined} aria-labelledby="home-agent-title" aria-live="polite">
      {beams.length ? (
        <svg className={styles.beams} aria-hidden="true">
          <defs>
            <linearGradient id="ha-beam" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#0066ff" stopOpacity="0" /><stop offset=".5" stopColor="#00d4ff" /><stop offset="1" stopColor="#0066ff" stopOpacity="0" /></linearGradient>
          </defs>
          {beams.map((b, i) => (
            <g key={b.id}>
              <path d={b.d} className={styles.beamTrack} />
              <circle cx={b.end.x} cy={b.end.y} r="3.5" className={styles.beamEnd} />
              {b.reading ? <path d={b.d} className={styles.beamFlow} style={{ animationDelay: `${i * 120}ms` }} /> : null}
            </g>
          ))}
        </svg>
      ) : null}

      {/* 見出しは「今日は、何をしますか？」の1つだけ（旧の欄と新しい欄をまとめた。2026-10-26 ユーザーの指示）。
          2026-10-29 本人の指示: 左の大きなクマの列をやめ、どの状態でも、クマは見出しの右の小さな絵にし、中身は横いっぱい1列にする。
          入力の画面では見出しを大きく、ほかの状態では小さく出し、クマは状態ごとのポーズにする（分析中は小さく息づく）。 */}
      <header className={styles.head} data-compact={scene === 'input' ? undefined : 'true'}>
        {greeting && scene === 'input' ? <p className={styles.headGreeting}>{greeting}</p> : null}
        {company && scene === 'input' ? <div className={styles.headCompany}>{company}</div> : null}
        <div className={styles.headRow}>
          <div className={styles.headText}>
            <h1 id="home-agent-title" className={styles.headTitle}>今日は、何をしますか？</h1>
            {scene !== 'input' ? <p className={styles.say}>{SAY[scene]}</p> : <p className={styles.heroSub}>やりたいことを書くだけ。ドヤAIが、全部のツールから合うものを選んで、準備まで進めます。</p>}
          </div>
          <div className={styles.kun} ref={kunRef}>
            <span className={styles.halo} aria-hidden="true" />
            {/* 状態ごとのポーズを重ねて、ふわっと入れ替える（Object.values の並びで固定）。入力の画面は 3D のドヤくん */}
            {scene === 'input' ? (
              <img src="/ui-renewal/mascots/growth-pro.webp" alt="ドヤくん" width={720} height={600} className={styles.pose} data-on="true" />
            ) : (
              Array.from(new Set(Object.values(POSE))).map((p) => (
                <img key={p} src={`/character/${p}-512.webp`} alt={p === pose ? 'ドヤくん' : ''} aria-hidden={p === pose ? undefined : true}
                  width={512} height={512} className={styles.pose} data-on={p === pose ? 'true' : undefined} />
              ))
            )}
          </div>
        </div>
      </header>

      <div className={styles.panel}>

        {scene === 'input' ? (
          <div className={styles.sceneIn}>
            {toolsOnly && dept ? (
              <div className={styles.card}>
                <p className={styles.eyebrow}>この部署でよく使う操作</p>
                <p className={styles.title}>どれから始めますか？</p>
                <p className={styles.lead}>ドヤくんの作戦づくりは、いまは営業の依頼に使えます。この部署では、道具の画面へ直接移れます。</p>
                <div className={styles.chips}>
                  {intentsOfDepartment(dept).map((it) => <Link key={it.label} href={toHref(it.href)} className={styles.chipLink} prefetch={false}>{it.label}</Link>)}
                </div>
              </div>
            ) : (
            <div className={styles.card}>
              {/* 見出し → 説明 → 入力欄（虹色の枠）→ 例 → ボタン の順に、ゆったり縦に並べる */}
              <div className={styles.aura}>
                <span className={styles.auraRing} aria-hidden="true" />
                <TypewriterTextarea id="home-agent-ask" aria-labelledby="home-agent-title" aria-describedby="home-agent-lead" ref={askRef} className={styles.textarea} value={text} onChange={(e) => setText(e.target.value)} rows={5} reduce={reduce} />
              </div>
              <p className={styles.chipsLabel}>例を押すと、欄に入ります</p>
              <div className={`${styles.chips} ${styles.exampleChips}`}>
                {AGENT_EXAMPLES.map((t) => <button key={t} type="button" className={styles.chip} aria-pressed={text === t} onClick={() => putExample(t)}>{t}</button>)}
              </div>
              {error ? <p className={styles.error} role="alert">{error}</p> : null}
              <div className={styles.row}>
                <span className={styles.muted}>{opening ?? '頼むだけでは、ドヤパワーは減りません'}</span>
                <button type="button" className={`${styles.btn} ${styles.btnAi}`} onClick={() => void send()} disabled={!text.trim() || Boolean(opening)} aria-busy={opening ? true : undefined}>{opening ? '進めています…' : 'ドヤAIに頼む'}</button>
              </div>
              <p id="home-agent-lead" className={`${styles.lead} ${styles.heroNote}`}>やりたいことを書いて、ドヤAIに頼んでください。材料を読んで、必要な作業に分けて進めます。登録の依頼は、その画面を入力した状態で開きます。</p>
            </div>
            )}
            {/* 新しい依頼を先に置き、前回の続きはその下にする（主な操作はゴールを書くこと。2026-10-26 統括の点検で、続きが上だと欄が 375px で y=507 まで下がっていた） */}
            {saved ? <ResumeCard saved={saved} onResume={() => resume(saved)} /> : null}
            <ToolShortcuts />
          </div>
        ) : null}

        {scene === 'fill' && route && route.missing[fillIndex] ? (() => {
          const field = route.missing[fillIndex]
          const got = route.action.fields.filter((f) => route.values[f.key])
          return (
            <div className={`${styles.card} ${styles.sceneIn}`}>
              <p className={styles.eyebrow}>{route.action.label}（{fillIndex + 1}/{route.missing.length}）</p>
              <p className={styles.title}>{field.ask ?? `${field.label}を教えてください`}</p>
              {got.length ? <p className={styles.lead}>読み取った内容: {got.map((f) => `${f.label} ${showValue(f, route.values[f.key])}`).join('、')}</p> : null}
              <div className={styles.question}>
                <label htmlFor="ha-fill" className={styles.qLabel}>{field.label}</label>
                <input id="ha-fill" className={styles.input} value={fillValue} autoFocus onChange={(e) => setFillValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) fillNext() }}
                  type={field.type === 'date' ? 'date' : field.type === 'email' ? 'email' : field.type === 'url' ? 'url' : 'text'}
                  inputMode={field.type === 'yen' || field.type === 'number' ? 'numeric' : field.type === 'url' ? 'url' : undefined}
                  placeholder={field.type === 'yen' ? '例: 200000' : field.type === 'url' ? 'https://example.co.jp' : undefined} />
                {fillError ? <p className={styles.error} role="alert">{fillError}</p> : null}
              </div>
              <p className={styles.help}>入れ終わると、読み取った内容を入れた状態で画面を開きます。最後の「{route.action.finalStep}」は、内容を確かめてから押してください。</p>
              <div className={styles.row}>
                <button type="button" className={`${styles.btn} ${styles.ghost}`} onClick={() => setScene('input')}>依頼を書き直す</button>
                <button type="button" className={styles.btn} onClick={fillNext} disabled={Boolean(opening)}>{opening ? '画面を開いています…' : fillIndex + 1 < route.missing.length ? '次へ' : '画面を開く'}</button>
              </div>
            </div>
          )
        })() : null}

        {scene === 'none' ? (
          <div className={`${styles.card} ${styles.sceneIn}`}>
            <p className={styles.title}>{suggest?.links.length || matchHomeIntent(text) ? '近い操作から選べます' : 'この依頼は、まだドヤAIに任せられません'}</p>
            <p className={styles.lead}>{suggest?.reason || '各ツールの画面から進められます。依頼を具体的に書き直すと、ドヤAIが画面を開けることがあります。'}</p>
            {suggest?.links.length || matchHomeIntent(text) ? (
              <div className={styles.chips}>
                {(suggest?.links.length ? suggest.links : [{ label: matchHomeIntent(text)!.label, href: matchHomeIntent(text)!.href }]).map((l) => (
                  <Link key={l.href} href={toHref(l.href)} className={styles.chipLink} prefetch={false}>{l.label}</Link>
                ))}
              </div>
            ) : null}
            <div className={styles.row}>
              <span />
              <button type="button" className={`${styles.btn} ${styles.ghost}`} onClick={() => setScene('input')}>依頼を書き直す</button>
            </div>
            <ToolShortcuts />
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
              <button type="button" className={styles.btn} onClick={submitAnswers}>ドヤAIに頼む</button>
            </div>
          </div>
        ) : null}

        {scene === 'analyze' ? (
          <div className={`${styles.card} ${styles.sceneIn}`}>
            <div className={styles.row}>
              <div><p className={styles.eyebrow}>分析しています</p><RevealWords as="p" className={styles.title} text={title || '作戦の材料を読んでいます'} /></div>
              <span className={styles.muted}>{readCount} / {Math.max(sources.length, 1)} 件</span>
            </div>
            <ul className={styles.sources}>
              {sources.map((s, k) => (
                <li key={s.id} data-src={s.id} className={styles.src} data-status={s.status} style={{ ['--k' as string]: k }}>
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
              {p.tasks.map((raw, ti) => {
                const t = byId.get(raw.id) ?? { ...raw, dependsOn: raw.after }
                const done = states[t.id]?.status === 'done'
                const can = t.delegable && t.ready.ok && !done
                return (
                  <li key={t.id} className={styles.todo} data-off={!t.delegate || !can ? 'true' : undefined} style={{ ['--k' as string]: pi * 3 + ti }}>
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
/** 足りない値の形が合わないときの案内 */
function fillHelp(f: AgentField): string {
  if (f.type === 'yen') return '金額は、円の数字で入れてください（例: 200000）。'
  if (f.type === 'date') return '日付を選んでください。'
  if (f.type === 'url') return 'https:// から始まるサイトの URL を入れてください。'
  if (f.type === 'email') return 'メールアドレスの形で入れてください。'
  return `${f.label}を入れてください。`
}

/** 読み取った値を、画面に出す形にする（金額はカンマ・円） */
function showValue(f: AgentField, v: string): string {
  return f.type === 'yen' ? `${Number(v).toLocaleString('ja-JP')}円` : v
}

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
