'use client'
// ============================================
// 実行の仕組みの見本の画面（聞く → 計画 → 同時に動かす → まとめ）
// ============================================
// ⚠️ 経営ホームの本番の画面は UIリニューアルが作る（src/components/home-agent/。設計 HOME-AGENT-EXPERIENCE-2026-10-25.md）。
//    これは、実行の仕組み（/api/agent/plan・/api/agent/tasks・runner.ts）を最後まで確かめるための見本。
//    今は開発の確認ページ（/home/agent-lab）だけが使う。
// 設計: docs/architecture/agent-orchestration/DESIGN.md §5・§8
// 展示会の型（docs/audits/2026-10-24-ux-clarity/TENJIKAI-PATTERNS.md）を使う:
//   T1 次にやること帯（NextStepBar）・T2 手順の札（FlowSteps）・T3 生成中の手順一覧（作業ごとの段）・
//   T4 ツールのキャラクター・T6 サンプル入力済み・T7 済んだ分を残して残りだけ作り直す
// ⚠️ 旗（AGENT_ORCHESTRATION_ROLLOUT）の内側だけで出す。判定はサーバー（page.tsx）。
// ⚠️ 作業を動かすのは「この計画で始める」を押したあとだけ（承認）。各ツールの利用枠とドヤパワーを使うため。
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowRight, CheckCircle2, CircleSlash, Loader2, RotateCcw, StopCircle, AlertTriangle, X } from 'lucide-react'
import { FlowSteps, NextStepAction, NextStepBar } from '@/components/ds'
import { parseSalesPrepAnswers, sampleAnswers, type AgentRecipe, type SalesPrepAnswers } from '@/lib/agent-orchestration/recipes'
import { progressOf, runAgentTasks, AgentTaskError, type AgentStates, type AgentTaskResult, type AgentTaskState } from '@/lib/agent-orchestration/runner'
import { fakeToolDeps, runSalesPrepTask, type SalesPrepTaskId } from '@/lib/agent-orchestration/tools'
import { planFromRecipe, planTasks } from '@/lib/agent-orchestration/plan'
import styles from './agent-orchestrator.module.css'

type Phase = 'ask' | 'plan' | 'run'
type Executor = 'api' | 'sample'

const FLOW = ['聞く', '計画を確かめる', 'ツールを動かす', 'まとめ'] as const
const STAGE_MS = 2600
const STORE_KEY = 'doya-agent-run:v1'
const MASCOT: Record<string, string> = {
  shodan: '/ui-renewal/mascots/shodan.webp',
  quote: '/ui-renewal/mascots/quote.webp',
  doyaslide: '/ui-renewal/mascots/doyaslide.webp',
}

interface SavedRun { recipeId: string; answers: Record<string, string>; states: AgentStates; savedAt: number }

function loadSaved(recipeId: string): SavedRun | null {
  try {
    const raw = window.localStorage.getItem(STORE_KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as SavedRun
    if (v?.recipeId !== recipeId || typeof v.savedAt !== 'number' || Date.now() - v.savedAt > 7 * 86400_000) return null
    return v
  } catch {
    return null
  }
}
function save(run: SavedRun) {
  try { window.localStorage.setItem(STORE_KEY, JSON.stringify(run)) } catch { /* 保存できなくても画面は動かす */ }
}

/** 1つの作業を、エージェントの API で動かす */
async function runViaApi(recipeId: string, taskId: string, answers: Record<string, string>, signal: AbortSignal, resume?: Record<string, string>): Promise<AgentTaskResult> {
  let res: Response
  try {
    res = await fetch('/api/agent/tasks', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ recipeId, taskId, answers, resume }), signal })
  } catch (e) {
    if ((e as { name?: string })?.name === 'AbortError') throw e
    throw new AgentTaskError('通信が切れました。もう一度お試しください。')
  }
  const data = await res.json().catch(() => null) as { result?: AgentTaskResult; error?: string; kind?: AgentTaskError['kind']; resume?: Record<string, string>; href?: { href: string; label: string } } | null
  if (res.ok && data?.result) return data.result
  if (res.status === 404) throw new AgentTaskError('この機能は、まだお使いいただけません。', 'auth')
  throw new AgentTaskError(data?.error || 'うまく作れませんでした。もう一度お試しください。', data?.kind ?? 'tool', data?.resume, data?.href)
}

const STATUS_LABEL: Record<AgentTaskState['status'], string> = {
  waiting: '待っています',
  running: '動いています',
  done: '済みました',
  failed: '作れませんでした',
  blocked: '前の作業を待っています',
  canceled: '止めました',
}

export default function AgentOrchestrator({ recipe, onClose, executor = 'api' }: {
  recipe: AgentRecipe
  onClose?: () => void
  /** sample は見本の結果で動かす（開発の確認ページ用。API も各ツールも呼ばない） */
  executor?: Executor
}) {
  const [phase, setPhase] = useState<Phase>('ask')
  const [answers, setAnswers] = useState<Record<string, string>>(() => sampleAnswers(recipe))
  const [askError, setAskError] = useState<{ id: string; text: string } | null>(null)
  const [states, setStates] = useState<AgentStates | null>(null)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState<SavedRun | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const ctrl = useRef<AbortController | null>(null)
  const root = useRef<HTMLElement | null>(null)
  const sampleDeps = useMemo(() => (executor === 'sample' ? fakeToolDeps({ failSlidesOnce: { done: false } }) : null), [executor])

  useEffect(() => { setSaved(loadSaved(recipe.id)) }, [recipe.id])
  // 段が変わったら、パネルの頭を画面に入れる（入力欄の下に開くため、そのままだと見えないことがある）
  useEffect(() => {
    const el = root.current
    if (!el || typeof el.scrollIntoView !== 'function') return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (el.getBoundingClientRect().top < 0 || el.getBoundingClientRect().top > window.innerHeight * 0.5) el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  }, [phase])
  useEffect(() => () => ctrl.current?.abort(), [])
  // 動いている間だけ、段の表示を進めるために時刻を更新する
  useEffect(() => {
    if (!busy) return
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [busy])

  const parsed = useMemo(() => parseSalesPrepAnswers(answers), [answers])
  const a: SalesPrepAnswers | null = parsed.ok ? parsed.value : null
  const plan = useMemo(() => (a ? planFromRecipe(recipe, a) : null), [recipe, a])
  const unanswered = recipe.questions.filter((q) => !answers[q.id]?.trim()).length

  const toPlan = () => {
    if (!parsed.ok) { setAskError({ id: parsed.questionId, text: parsed.error }); return }
    setAskError(null)
    setPhase('plan')
  }

  const start = useCallback(async (prev?: AgentStates) => {
    if (!a) return
    const c = new AbortController()
    ctrl.current = c
    setPhase('run')
    setBusy(true)
    const out = await runAgentTasks({
      tasks: recipe.tasks,
      prev,
      concurrency: 3,
      signal: c.signal,
      onChange: setStates,
      execute: (task, { signal, resume }) => sampleDeps
        ? runSalesPrepTask(task.id as SalesPrepTaskId, a, sampleDeps, resume)
        : runViaApi(recipe.id, task.id, answers, signal, resume),
    })
    setStates(out)
    setBusy(false)
    save({ recipeId: recipe.id, answers, states: out, savedAt: Date.now() })
  }, [a, answers, recipe, sampleDeps])

  const stop = () => ctrl.current?.abort()
  const restart = () => { setStates(null); setPhase('ask') }
  const openSaved = () => {
    if (!saved) return
    setAnswers(saved.answers)
    setStates(saved.states)
    setPhase('run')
  }

  const prog = states ? progressOf(states) : null
  const flowIndex = phase === 'ask' ? 0 : phase === 'plan' ? 1 : prog?.finished ? 3 : 2
  const remaining = prog ? prog.total - prog.done : 0
  const firstDone = states ? recipe.tasks.map((t) => states[t.id]?.result).find(Boolean) : undefined

  // T1 次にやること帯（一文と主ボタン1つ）
  let bar: { text: string; state: 'empty' | 'working' | 'done' | 'error'; action?: ReactNode }
  if (phase === 'ask') {
    bar = { text: unanswered ? `次は、${recipe.questions.length}つの質問に答えます（あと${unanswered}つ）。` : '答えがそろいました。次は、使うツールと順番を確かめます。', state: 'empty', action: <NextStepAction onClick={toPlan}>計画を見る</NextStepAction> }
  } else if (phase === 'plan') {
    bar = { text: `次は、${recipe.tasks.length}つのツールを同時に動かします。`, state: 'empty', action: <NextStepAction onClick={() => start()}>この計画で始める</NextStepAction> }
  } else if (!prog || !prog.finished) {
    bar = { text: `今${prog?.running ?? 0}個のツールが動いています（${prog?.done ?? 0}/${recipe.tasks.length} 完了）。`, state: 'working' }
  } else if (remaining === 0) {
    bar = { text: `${recipe.tasks.length}つのツールの結果がそろいました。各ツールで仕上げます。`, state: 'done', action: firstDone ? <NextStepAction href={firstDone.href}>{firstDone.hrefLabel}</NextStepAction> : undefined }
  } else {
    bar = { text: `${prog.done}つは済みました。残りの${remaining}つを、続きから動かせます。`, state: 'error', action: <NextStepAction onClick={() => start(states ?? undefined)} iconNode={<RotateCcw size={16} aria-hidden />}>{`残りの${remaining}つを動かす`}</NextStepAction> }
  }

  return (
    <section ref={root} className={styles.panel} aria-label={recipe.title}>
      <div className={styles.head}>
        <div>
          <p className={styles.eyebrow}>まとめて進める</p>
          <h2 className={styles.title}>{recipe.title}</h2>
        </div>
        {onClose && !busy ? (
          <button type="button" className={styles.close} onClick={onClose} aria-label="閉じる"><X size={18} /></button>
        ) : null}
      </div>
      <FlowSteps steps={FLOW} current={flowIndex} label="エージェントの進め方" />
      <NextStepBar text={bar.text} state={bar.state} action={bar.action} />

      {phase === 'ask' ? (
        <div className={styles.questions}>
          <div className={styles.questionsHead}>
            <p className={styles.lead}>{recipe.lead}</p>
            <span className={styles.sampleTag}>例を入れてあります</span>
          </div>
          {saved ? (
            <p className={styles.saved}>
              {new Date(saved.savedAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}の結果が残っています。
              <button type="button" className={styles.linkButton} onClick={openSaved}>前回のまとめを開く</button>
            </p>
          ) : null}
          {recipe.questions.map((q, i) => (
            <fieldset key={q.id} className={styles.question} aria-invalid={askError?.id === q.id || undefined}>
              <legend className={styles.qLabel}><span className={styles.qNo}>{i + 1}</span>{q.label}</legend>
              {q.kind === 'text' ? (
                <input
                  className={styles.text}
                  value={answers[q.id] ?? ''}
                  onChange={(e) => setAnswers((s) => ({ ...s, [q.id]: e.target.value }))}
                  placeholder={q.placeholder}
                  inputMode="url"
                  autoComplete="url"
                  aria-label={q.label}
                  maxLength={2048}
                />
              ) : (
                <div className={styles.options} role="radiogroup" aria-label={q.label}>
                  {q.options?.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      role="radio"
                      aria-checked={answers[q.id] === o.value}
                      className={styles.option}
                      onClick={() => setAnswers((s) => ({ ...s, [q.id]: o.value }))}
                    >{o.label}</button>
                  ))}
                </div>
              )}
              {q.help ? <p className={styles.help}>{q.help}</p> : null}
              {askError?.id === q.id ? <p className={styles.askError} role="alert">{askError.text}</p> : null}
            </fieldset>
          ))}
        </div>
      ) : null}

      {phase === 'plan' && a && plan ? (
        <div className={styles.plan}>
          <p className={styles.lead}>{recipe.lead}</p>
          <ol className={styles.planList}>
            {planTasks(plan).map((t) => (
              <li key={t.id} className={styles.planItem}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={MASCOT[t.tool]} alt="" className={styles.mascot} width={56} height={56} />
                <div className={styles.planBody}>
                  <span className={styles.tool}>{t.toolName}</span>
                  <p className={styles.planLabel}>{t.title}</p>
                  <p className={styles.planMakes}>{t.makes}</p>
                  <p className={styles.planUses}>{t.power > 0 ? `ドヤパワー ${t.power}（使うときだけ）・` : ''}{t.uses}・目安 {t.minutes}分</p>
                </div>
              </li>
            ))}
          </ol>
          <p className={styles.planUses}>ドヤパワーを使う設定のときは、合計で {plan.totalPower} 減ります。失敗したツールの分は戻ります。</p>
          <p className={styles.note}>3つのツールを同時に動かします。作ったものはどれも下書きです。送る・確定するのは、各ツールの画面であなたが行います。</p>
          <button type="button" className={styles.secondary} onClick={() => setPhase('ask')}>答えを直す</button>
        </div>
      ) : null}

      {phase === 'run' && states && a ? (
        <div className={styles.runArea}>
          <p className={styles.counter} aria-live="polite">
            {busy ? <><Loader2 size={16} className={styles.spin} aria-hidden />{(prog?.running ?? 0) > 1 ? `今${prog?.running}個のツールが同時に動いています` : `今${prog?.running ?? 0}個のツールが動いています`}</> : prog?.done === prog?.total ? <><CheckCircle2 size={16} aria-hidden />すべてのツールが終わりました</> : <><AlertTriangle size={16} aria-hidden />終わっていない作業があります</>}
          </p>
          <ul className={styles.cards}>
            {recipe.tasks.map((t) => {
              const st = states[t.id]
              const stages = t.stages(a)
              const at = st?.status === 'running' && st.startedAt ? Math.min(stages.length - 1, Math.floor((now - st.startedAt) / STAGE_MS)) : -1
              return (
                <li key={t.id} className={styles.card} data-status={st?.status}>
                  <div className={styles.cardHead}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={MASCOT[t.toolId]} alt="" className={styles.mascotSm} width={40} height={40} />
                    <div className={styles.cardTitle}>
                      <span className={styles.tool}>{t.toolName}</span>
                      <p className={styles.planLabel}>{t.label(a)}</p>
                    </div>
                    <span className={styles.status} data-status={st?.status}>
                      {st?.status === 'running' ? <Loader2 size={14} className={styles.spin} aria-hidden />
                        : st?.status === 'done' ? <CheckCircle2 size={14} aria-hidden />
                        : st?.status === 'failed' ? <AlertTriangle size={14} aria-hidden />
                        : st?.status === 'canceled' || st?.status === 'blocked' ? <CircleSlash size={14} aria-hidden /> : null}
                      {STATUS_LABEL[st?.status ?? 'waiting']}
                    </span>
                  </div>
                  {st?.status === 'running' || st?.status === 'waiting' ? (
                    <ol className={styles.stages}>
                      {stages.map((s, i) => (
                        <li key={s} data-state={i < at ? 'done' : i === at ? 'now' : 'next'}>{s}</li>
                      ))}
                    </ol>
                  ) : null}
                  {st?.status === 'done' && st.result ? (
                    <div className={styles.result}>
                      <p className={styles.summary}>{st.result.summary}</p>
                      {st.result.points.length ? (
                        <ul className={styles.points}>{st.result.points.map((p, i) => <li key={i}>{p}</li>)}</ul>
                      ) : null}
                      <Link href={st.result.href} className={styles.open} prefetch={false}>{st.result.hrefLabel}<ArrowRight size={15} aria-hidden /></Link>
                    </div>
                  ) : null}
                  {st && (st.status === 'failed' || st.status === 'blocked' || st.status === 'canceled') ? (
                    <div className={styles.failed} role={st.status === 'failed' ? 'alert' : 'status'}>
                      <p>{st.error}</p>
                      {st.failure?.href ? <Link href={st.failure.href} className={styles.open} prefetch={false}>{st.failure.hrefLabel ?? '開く'}<ArrowRight size={15} aria-hidden /></Link> : null}
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
          <div className={styles.runFoot}>
            {busy ? (
              <button type="button" className={styles.secondary} onClick={stop}><StopCircle size={16} aria-hidden />止める</button>
            ) : (
              <button type="button" className={styles.secondary} onClick={restart}>新しく頼む</button>
            )}
            <p className={styles.note}>作ったものはどれも下書きです。送る・確定するのは、各ツールの画面であなたが行います。</p>
          </div>
        </div>
      ) : null}
    </section>
  )
}
