'use client'
// ============================================
// 経営ホーム 画面本体
// ============================================
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight, Send, StopCircle, CheckCircle2, Loader2, RefreshCw, TrendingUp, Wallet, FileText, FolderKanban,
  Clock, Users, CreditCard, AlertTriangle, ChevronLeft, ChevronRight, X,
} from 'lucide-react'
import type { HomeSummary, HomeEvent } from '@/lib/home/summary'
import { SHELL_GROUPS } from '@/components/shell/tools'
import { ShellIcon } from '@/components/shell/icons'
import { AGENT_SUGGESTIONS, planAgent, type AgentPlan } from './agent'
import { HOME_INTENT_GROUPS, matchHomeIntent } from './intents'
import { todayItems } from './today'
import { SETUP_HIDE_COOKIE } from './cookies'
import { CountUp } from '@/components/ds/motion'
import { AreaChart, Bars } from '@/components/ds/charts'
import { CompanyRegisterButton, ShellCompanyTag } from '@/components/shell/ShellCompanyCard'
import { useAccountCompany } from '@/components/shell/company-context'
import { useToolHref } from '@/components/shell/ui-next-context'
import styles from './home.module.css'
import type { ReactNode } from 'react'

const man = (n: number) => {
  if (Math.abs(n) >= 100_000_000) return `${(Math.round(n / 10_000_000) / 10).toLocaleString('ja-JP')}億円`
  if (Math.abs(n) >= 10_000) return `${(Math.round(n / 1000) / 10).toLocaleString('ja-JP')}万円`
  return `${Math.round(n).toLocaleString('ja-JP')}円`
}

const STEP_MS = 520

/** API 経由のリダイレクト（決済ポータル等）は画面遷移ではなく通常のリンクで開く */
function SmartLink({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  if (href.startsWith('/api/')) return <a href={href} className={className}>{children}</a>
  return <Link href={href} className={className}>{children}</Link>
}

/* ---------------- エージェント ---------------- */

type RunState = { plan: AgentPlan; query: string; shown: number; status: 'running' | 'done' | 'stopped' }

function AgentPanel({ summary, greeting }: { summary: HomeSummary; greeting: string }) {
  // 組織を選ぶツールは、入口ではなく組織のページへ（中身がある）
  const toHref = useToolHref()
  const router = useRouter()
  const [opening, setOpening] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [run, setRun] = useState<RunState | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clear = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null } }
  useEffect(() => clear, [])

  const start = useCallback((query: string) => {
    const q = query.trim()
    if (!q) return
    clear()
    // 「〜を作りたい」のように、ツールの作業を頼む文なら、そのツールを開く（UI 品質 H-2）
    const intent = matchHomeIntent(q)
    if (intent) {
      setOpening(intent.label)
      setRun(null)
      setInput('')
      router.push(toHref(intent.href))
      return
    }
    setOpening(null)
    // 数字の質問（売上・残業・パイプラインなど）は、各ツールを読んで答える
    const plan = planAgent(q, summary)
    setRun({ plan, query: q, shown: 0, status: 'running' })
    setInput('')
  }, [summary, router, toHref])

  useEffect(() => {
    if (!run || run.status !== 'running') return
    if (run.shown >= run.plan.steps.length) {
      setRun((r) => (r ? { ...r, status: 'done' } : r))
      return
    }
    timer.current = setTimeout(() => setRun((r) => (r && r.status === 'running' ? { ...r, shown: r.shown + 1 } : r)), STEP_MS)
    return clear
  }, [run])

  const stop = () => { clear(); setRun((r) => (r ? { ...r, status: 'stopped' } : r)) }

  return (
    <section className={styles.agent} aria-label="やりたいことを頼む">
      <p className={styles.agentGreeting}>{greeting}</p>
      {/* 今の会社（UI 品質 B-2）。組織が無ければ何も出さない */}
      <ShellCompanyTag className={styles.agentCompany} />
      <h1 className={styles.agentTitle}>今日は、何をしますか？</h1>
      <form
        className={styles.ask}
        onSubmit={(e) => { e.preventDefault(); start(input) }}
      >
        <input
          className={styles.askInput}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="例: 請求書を作りたい"
          aria-label="エージェントへの依頼"
          maxLength={200}
        />
        <button type="submit" className={styles.askButton} disabled={!input.trim()} aria-label="依頼する">
          <Send size={18} />
        </button>
      </form>
      {opening ? <p className={styles.opening} role="status">「{opening}」の画面を開いています</p> : null}
      <div className={styles.intents}>
        {HOME_INTENT_GROUPS.map((g) => (
          <div key={g.label} className={styles.intentGroup}>
            <p className={styles.intentLabel}>{g.label}</p>
            <div className={styles.chips}>
              {g.intents.map((it) => (
                <Link key={it.label} href={toHref(it.href)} className={styles.chip} prefetch={false}>{it.label}</Link>
              ))}
            </div>
          </div>
        ))}
        <div className={styles.intentGroup}>
          <p className={styles.intentLabel}>数字をたずねる</p>
          <div className={styles.chips}>
            {AGENT_SUGGESTIONS.map((q) => (
              <button key={q} type="button" className={styles.chip} onClick={() => start(q)}>{q}</button>
            ))}
          </div>
        </div>
      </div>

      {run ? (
        <div className={styles.run} aria-live="polite">
          <div className={styles.runHead}>
            <p className={styles.runQuery}>「{run.query}」</p>
            {run.status === 'running' ? (
              <button type="button" className={styles.stop} onClick={stop}>
                <StopCircle size={16} /> 止める
              </button>
            ) : null}
          </div>
          <ol className={styles.steps}>
            {run.plan.steps.map((step, i) => {
              const state = i < run.shown ? 'done' : i === run.shown && run.status === 'running' ? 'active' : 'idle'
              if (run.status === 'stopped' && state === 'idle' && i > run.shown) return null
              return (
                <li key={`${step.tool}-${i}`} className={styles.step} data-state={state}>
                  {state === 'done' ? <CheckCircle2 size={16} /> : state === 'active' ? <Loader2 size={16} className={styles.spin} /> : <span className={styles.dot} />}
                  <span className={styles.stepTool}>{step.tool}</span>
                  <span>{step.label}</span>
                </li>
              )
            })}
          </ol>
          {run.status === 'stopped' ? <p className={styles.muted}>途中で止めました。もう一度依頼するとはじめから進めます。</p> : null}
          {run.status === 'done' ? (
            <div className={styles.answer}>
              <h3 className={styles.answerTitle}>{run.plan.title}</h3>
              <p className={styles.answerLead}>{run.plan.lead}</p>
              {run.plan.rows.length ? (
                <dl className={styles.rows}>
                  {run.plan.rows.map((r, i) => (
                    <div key={`${r.label}-${i}`} className={styles.row} data-tone={r.tone}>
                      <dt>{r.label}</dt>
                      <dd>{r.value}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
              {run.plan.actions.length ? (
                <div className={styles.actions}>
                  {run.plan.actions.map((a) => (
                    <SmartLink key={a.label} href={a.href} className={styles.action}>
                      {a.label} <ArrowRight size={15} />
                    </SmartLink>
                  ))}
                </div>
              ) : null}
              <p className={styles.note}>読み取りは自動で行います。作成・送信・お支払いなどは、移動先の画面であなたが確認してから実行します。</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

/* ---------------- 指標カード ---------------- */

function Kpi({ icon: Icon, label, value, sub, href, muted }: { icon: typeof Wallet; label: string; value: number | null; sub?: string; href: string; muted?: boolean }) {
  return (
    <Link href={href} className={styles.kpi} data-muted={muted ? 'true' : undefined}>
      <span className={styles.kpiIcon}><Icon size={18} /></span>
      <span className={styles.kpiLabel}>{label}</span>
      <span className={styles.kpiValue}>{value === null ? '—' : <CountUp value={value} format={man} />}</span>
      {sub ? <span className={styles.kpiSub}>{sub}</span> : null}
    </Link>
  )
}

/* ---------------- 今日やること（UI 品質 S-10） ---------------- */

/**
 * 会社をまだ登録していない人への案内（UI 品質 S-9・B-1）。1行の細い帯で、入力（主役）の下に出す。閉じたら、このブラウザでは出さない。
 * 押すと、会社名とサイトの URL を入れる小さな画面が開く。左下の「会社情報」からも、いつでも登録できる。
 */
function CompanySetupNote({ initiallyHidden, doyaPower }: { initiallyHidden: boolean; doyaPower: boolean }) {
  const company = useAccountCompany()
  const [hidden, setHidden] = useState(initiallyHidden)
  // undefined は今の見た目（出さない）。登録済み（source が company）なら出さない
  if (hidden || company === undefined || company?.source === 'company') return null
  const hide = () => {
    setHidden(true)
    try { document.cookie = `${SETUP_HIDE_COOKIE}=1; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax` } catch { /* 覚えられなくても閉じる */ }
  }
  return (
    <section className={styles.setup} aria-labelledby="home-setup-title">
      <div className={styles.setupBody}>
        <h2 id="home-setup-title" className={styles.setupTitle}>会社を登録してください</h2>
        <p className={styles.setupText}>
          {company ? <>まだ会社が登録されていません。今は、ほかのツールの組織の名前「{company.name}」を仮に出しています。</> : 'まだ会社が登録されていません。'}
          ドヤマーケAIは、1つのアカウントで1つの会社を扱います。
          {/* ドヤパワーの台帳は会社ごと。旗の内側だけ、登録するとゲージが出ることを伝える */}
          {doyaPower ? '登録すると、ドヤパワー（使える量）のゲージが出ます。' : null}
        </p>
      </div>
      <CompanyRegisterButton className={styles.setupAction}>会社を登録する</CompanyRegisterButton>
      <button type="button" className={styles.setupClose} onClick={hide} aria-label="この案内を閉じる"><X size={16} aria-hidden /></button>
    </section>
  )
}

function TodayCard({ summary }: { summary: HomeSummary }) {
  const items = todayItems(summary)
  return (
    <section className={styles.today} aria-labelledby="home-today">
      <h2 id="home-today" className={styles.todayTitle}>今日やること</h2>
      {items.length ? (
        <ul className={styles.todayList}>
          {items.map((i) => (
            <li key={i.key}>
              <Link href={i.href} className={styles.todayItem} data-urgent={i.urgent ? 'true' : undefined}>
                <span className={styles.todayDot} aria-hidden />
                <span>{i.label}</span>
                <span className={styles.todayGo} aria-hidden>開く</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.todayEmpty}>今日、急いで手を付けるものはありません。</p>
      )}
    </section>
  )
}

/* ---------------- 月次推移 ---------------- */

function TrendChart({ trend }: { trend: HomeSummary['trend'] }) {
  const empty = trend.every((p) => p.won === 0 && p.quoted === 0)
  return (
    <div className={styles.chartWrap}>
      <AreaChart
        labels={trend.map((p) => `${Number(p.month.slice(5))}月`)}
        series={[
          { name: '受注（営業管理）', values: trend.map((p) => p.won) },
          { name: '確定見積（税抜）', values: trend.map((p) => p.quoted), tone: 'cyan' },
        ]}
        format={man}
      />
      {empty ? <p className={styles.chartEmpty}>まだ受注・確定見積のデータがありません</p> : null}
    </div>
  )
}

/* ---------------- パイプライン ---------------- */

function Pipeline({ sales }: { sales: HomeSummary['sales'] }) {
  if (sales.state !== 'ready') {
    return <EmptyCard text="営業管理で商談を登録すると、段階ごとの金額がここに並びます。" href="/sfa" cta="営業管理をはじめる" />
  }
  const max = Math.max(1, ...sales.stages.map((s) => s.amount))
  return (
    <div>
      <Bars data={sales.stages.map((st) => ({ label: st.name, value: st.amount, sub: `${st.count}件` }))} format={man} />
      <div className={styles.funnelFoot}>
        <span>営業タスク {sales.openTasks}件</span>
        {sales.overdueTasks > 0 ? <span className={styles.warn}><AlertTriangle size={14} /> 期限切れ {sales.overdueTasks}件</span> : null}
        <span>今月の新規リード {sales.newLeads}件</span>
      </div>
    </div>
  )
}

/* ---------------- カレンダー（仮） ---------------- */

const KIND_LABEL: Record<HomeEvent['kind'], string> = { deal: '受注予定', task: 'タスク', project: '納期', quote: '見積期限' }

function jstDateKey(iso: string | Date) {
  const d = new Date(typeof iso === 'string' ? iso : iso.getTime())
  const j = new Date(d.getTime() + 9 * 3600_000)
  return `${j.getUTCFullYear()}-${String(j.getUTCMonth() + 1).padStart(2, '0')}-${String(j.getUTCDate()).padStart(2, '0')}`
}

function MiniCalendar({ events }: { events: HomeEvent[] }) {
  const today = jstDateKey(new Date())
  const [offset, setOffset] = useState(0)
  const [selected, setSelected] = useState(today)
  const [y0, m0] = today.split('-').map(Number)
  const base = new Date(Date.UTC(y0, m0 - 1 + offset, 1))
  const year = base.getUTCFullYear()
  const month = base.getUTCMonth()
  const firstDow = base.getUTCDay()
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()

  const byDay = useMemo(() => {
    const m = new Map<string, HomeEvent[]>()
    events.forEach((e) => {
      const k = jstDateKey(e.date)
      m.set(k, [...(m.get(k) ?? []), e])
    })
    return m
  }, [events])

  const cells: (string | null)[] = [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from({ length: days }, (_, i) => `${year}-${String(month + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`),
  ]
  const list = byDay.get(selected) ?? []

  return (
    <div className={styles.calendar}>
      <div className={styles.calHead}>
        <button type="button" onClick={() => setOffset((o) => o - 1)} aria-label="前の月"><ChevronLeft size={16} /></button>
        <span>{year}年{month + 1}月</span>
        <button type="button" onClick={() => setOffset((o) => o + 1)} aria-label="次の月"><ChevronRight size={16} /></button>
      </div>
      <div className={styles.calGrid} role="grid">
        {['日', '月', '火', '水', '木', '金', '土'].map((d) => <span key={d} className={styles.calDow}>{d}</span>)}
        {cells.map((key, i) =>
          key ? (
            <button
              key={key}
              type="button"
              className={styles.calDay}
              data-today={key === today ? 'true' : undefined}
              data-selected={key === selected ? 'true' : undefined}
              onClick={() => setSelected(key)}
            >
              {Number(key.slice(8))}
              {byDay.has(key) ? <i className={styles.calDot} /> : null}
            </button>
          ) : <span key={`e${i}`} />,
        )}
      </div>
      <div className={styles.calList}>
        <p className={styles.calListHead}>{Number(selected.slice(5, 7))}月{Number(selected.slice(8))}日の期日</p>
        {list.length ? (
          <ul>
            {list.map((e) => (
              <li key={e.id}>
                <Link href={e.href}><span className={styles.calKind} data-kind={e.kind}>{KIND_LABEL[e.kind]}</span>{e.title}</Link>
              </li>
            ))}
          </ul>
        ) : <p className={styles.muted}>この日の期日はありません</p>}
      </div>
      <p className={styles.note}>仮のカレンダーです。営業管理・見積・プロマネに登録された期日を表示しています。</p>
    </div>
  )
}

function MoneyCard({ money }: { money: NonNullable<HomeSummary['money']> }) {
  const { income, expense } = money
  return (
    <section className={styles.card} aria-label="入金と出金の予定">
      <div className={styles.cardHead}><h2>今月の入金と出金</h2></div>
      <div className={styles.gridWide}>
        <div>
          <p className={styles.toolGroupLabel}>入金（収入管理）</p>
          {income.state === 'ready' ? (
            <dl className={styles.stats}>
              <div><dt>今月の売上予定</dt><dd>{man(income.scheduled)}</dd></div>
              <div><dt>入金済み</dt><dd>{man(income.received)}</dd></div>
              <div><dt>入金待ち</dt><dd>{man(income.unpaid)}{income.overdueCount > 0 ? `（遅れ ${income.overdueCount}件）` : ''}</dd></div>
            </dl>
          ) : income.state === 'error' ? <p className={styles.error} role="status">読み込めませんでした</p>
            : <EmptyCard text="契約と請求書を登録すると、入金の予定がここに出ます。" href={income.href} cta="収入管理をはじめる" />}
        </div>
        <div>
          <p className={styles.toolGroupLabel}>出金（支出管理）</p>
          {expense.state === 'ready' ? (
            <dl className={styles.stats}>
              <div><dt>今月の出金予定</dt><dd>{man(expense.thisMonthOut)}</dd></div>
              <div><dt>支払済み</dt><dd>{man(expense.paid)}</dd></div>
              <div><dt>来月の出金予定</dt><dd>{man(expense.nextMonthOut)}</dd></div>
            </dl>
          ) : expense.state === 'error' ? <p className={styles.error} role="status">読み込めませんでした</p>
            : <EmptyCard text="契約と支払を登録すると、出金の予定がここに出ます。" href={expense.href} cta="支出管理をはじめる" />}
        </div>
      </div>
    </section>
  )
}

function EmptyCard({ text, href, cta }: { text: string; href: string; cta: string }) {
  return (
    <div className={styles.emptyCard}>
      <p>{text}</p>
      <Link href={href} className={styles.action}>{cta} <ArrowRight size={15} /></Link>
    </div>
  )
}

/* ---------------- 本体 ---------------- */

// setupHidden: 会社の登録の案内を閉じたか（サーバーが cookie から読む。最初の描画から出す・出さないを決め、あとから出さない）
export default function HomeDashboard({ initial, setupHidden = false, powerCard = null, doyaPower = false }: {
  initial: HomeSummary
  setupHidden?: boolean
  /** ドヤパワーの欄（旗の内側だけ。page.tsx が旗を見て作って渡す。渡されなければ何も出さない） */
  powerCard?: ReactNode
  /** ドヤパワーの旗が出すと決めた人か（page.tsx が isDoyaPowerEnabled() で決めて渡す。会社の登録の案内の文に使う） */
  doyaPower?: boolean
}) {
  const [summary, setSummary] = useState(initial)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/home/summary', { cache: 'no-store' })
      if (!res.ok) throw new Error()
      setSummary(await res.json())
    } catch {
      setError('最新の数字を取得できませんでした。時間をおいて再度お試しください。')
    } finally {
      setLoading(false)
    }
  }

  const s = summary
  const c = s.contract
  const greeting = (() => {
    const h = new Date().getHours()
    return h < 11 ? 'おはようございます' : h < 18 ? 'こんにちは' : 'おつかれさまです'
  })()
  const updated = new Date(s.generatedAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
  // 数字の出所（ADDON-SERVICES §4）。収入管理・支出管理を使っている組織では、そちらが正本になる
  const revenueSource = s.sources.revenue === 'income' ? '収入管理' : '営業管理・見積'
  const costSource = s.sources.cost === 'expense' ? '支出管理' : 'プロマネ（経費と人件費）'
  const periodEnd = c.currentPeriodEnd ? new Date(c.currentPeriodEnd).toLocaleDateString('ja-JP') : null

  return (
    <div className={styles.page}>
      {/* 入力が主役（UI 品質 H-2）。集計は、その下に置く */}
      <AgentPanel summary={s} greeting={`${greeting}${s.user.name ? `、${s.user.name}さん` : ''}`} />
      {/* 会社の登録の案内は、入力（主役）の下に1行で（UI 品質 B-1・S-9） */}
      <CompanySetupNote initiallyHidden={setupHidden} doyaPower={doyaPower} />

      <TodayCard summary={s} />

      {/* ドヤパワーの残り・次の回復・期限が近い分（旗の内側だけ。渡されなければ何も出さない）。枠のゲージは内訳・履歴の画面へ来る */}
      {powerCard}

      <header className={styles.hero}>
        <div>
          <h2 className={styles.sectionTitle}>今月の数字</h2>
          <p className={styles.sources}>全ツールからまとめています。売上は{revenueSource}、支出は{costSource}の数字です。</p>
        </div>
        <button type="button" className={styles.refresh} onClick={refresh} disabled={loading}>
          <RefreshCw size={15} className={loading ? styles.spin : undefined} /> {updated} 時点
        </button>
      </header>
      {error ? <p className={styles.error} role="alert">{error}</p> : null}

      <section className={styles.kpis} aria-label="今月の主要な数字">
        <Kpi icon={TrendingUp} label="今月の受注" value={s.sales.state === 'ready' ? s.sales.wonThisMonth : null} sub={s.sales.state === 'ready' ? `${s.sales.wonCountThisMonth}件` : '営業管理が未使用'} href={s.sales.href} muted={s.sales.state !== 'ready'} />
        <Kpi icon={FileText} label="今月確定した見積" value={s.quotes.state === 'ready' ? s.quotes.confirmedThisMonth : null} sub={s.quotes.state === 'ready' ? `下書き ${s.quotes.draftCount}件` : '見積が未使用'} href={s.quotes.href} muted={s.quotes.state !== 'ready'} />
        <Kpi icon={Wallet} label="受注見込み（確度で加重）" value={s.sales.state === 'ready' ? s.sales.weightedPipeline : null} sub={s.sales.state === 'ready' ? `進行中 ${s.sales.openDeals}件 / ${man(s.sales.openPipeline)}` : undefined} href={s.sales.state === 'ready' ? `${s.sales.href}/deals` : '/sfa'} muted={s.sales.state !== 'ready'} />
        <Kpi icon={FolderKanban} label="プロジェクト利益" value={s.projects.state === 'ready' ? s.projects.profit : null} sub={s.projects.state === 'ready' ? `売上 ${man(s.projects.revenue)} ・ 原価 ${man(s.projects.cost)}` : 'プロマネが未使用'} href={s.projects.href} muted={s.projects.state !== 'ready'} />
      </section>

      {s.money ? <MoneyCard money={s.money} /> : null}

      <div className={styles.gridWide}>
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2>売上の推移</h2>
            <span className={styles.cardMeta}>直近6か月</span>
          </div>
          <TrendChart trend={s.trend} />
        </section>
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2>パイプライン</h2>
            {s.sales.state === 'ready' ? <Link href={`${s.sales.href}/deals`} className={styles.cardLink}>開く</Link> : null}
          </div>
          <Pipeline sales={s.sales} />
        </section>
      </div>

      <div className={styles.gridWide}>
        <section className={styles.card}>
          <div className={styles.cardHead}><h2>カレンダー</h2><span className={styles.badge}>仮</span></div>
          <MiniCalendar events={s.events} />
        </section>
        <section className={styles.card}>
          <div className={styles.cardHead}><h2>プロジェクト収支</h2>{s.projects.state === 'ready' ? <Link href={s.projects.href} className={styles.cardLink}>レポート</Link> : null}</div>
          {s.projects.state === 'ready' && s.projects.top.length ? (
            <ul className={styles.projectList}>
              {s.projects.top.map((p) => (
                <li key={p.name}>
                  <span className={styles.projectName}>{p.name}</span>
                  <span>{man(p.revenue)}</span>
                  <span data-tone={p.profit >= 0 ? 'good' : 'warn'}>{p.profit >= 0 ? '+' : ''}{man(p.profit)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyCard text="プロマネで案件を登録すると、売上・原価・利益が案件ごとに並びます。" href="/promane" cta="プロマネをはじめる" />
          )}
        </section>
      </div>

      <div className={styles.gridThree}>
        <section className={styles.card}>
          <div className={styles.cardHead}><h2><Clock size={16} /> 勤怠</h2><span className={styles.cardMeta}>{s.attendance.state === 'ready' ? (s.attendance.scope === 'org' ? '全社' : 'あなた') : ''}</span></div>
          {s.attendance.state === 'ready' ? (
            <dl className={styles.stats}>
              <div><dt>今月の労働時間</dt><dd>{s.attendance.workHoursThisMonth}時間</dd></div>
              <div><dt>残業</dt><dd>{s.attendance.overtimeHoursThisMonth}時間</dd></div>
              <div><dt>承認待ち</dt><dd>{s.attendance.pendingRequests}件</dd></div>
            </dl>
          ) : <EmptyCard text="打刻と残業をここでまとめます。" href="/kintai" cta="勤怠をはじめる" />}
        </section>
        <section className={styles.card}>
          <div className={styles.cardHead}><h2><Users size={16} /> 人と組織</h2></div>
          {s.people.state === 'ready' ? (
            <dl className={styles.stats}>
              <div><dt>在籍者</dt><dd>{s.people.activeEmployees}名</dd></div>
              <div><dt>部署</dt><dd>{s.people.departments}</dd></div>
            </dl>
          ) : <EmptyCard text="社員・部署・評価をここでまとめます。" href="/hr" cta="人事をはじめる" />}
        </section>
        <section className={styles.card}>
          <div className={styles.cardHead}><h2><CreditCard size={16} /> ご契約</h2></div>
          <dl className={styles.stats}>
            <div><dt>プラン</dt><dd>{c.label}</dd></div>
            <div><dt>状態</dt><dd>{c.cancelAtPeriodEnd ? '期間終了で解約予定' : c.paid ? '契約中' : '無料'}</dd></div>
            {periodEnd ? <div><dt>{c.cancelAtPeriodEnd ? '利用できる期限' : '次回更新日'}</dt><dd>{periodEnd}</dd></div> : null}
          </dl>
          <SmartLink href={c.paid ? '/api/stripe/portal?returnTo=/home' : '/pricing'} className={styles.cardLink}>
            {c.paid ? '契約内容・お支払い方法を確認' : '料金プランを見る'}
          </SmartLink>
        </section>
      </div>

      <section className={styles.card}>
        <div className={styles.cardHead}><h2>すべてのツール</h2></div>
        <div className={styles.toolGroups}>
          {SHELL_GROUPS.map((g) => (
            <div key={g.label}>
              <p className={styles.toolGroupLabel}>{g.label}</p>
              <div className={styles.tools}>
                {g.tools.map((t) => (
                  <Link key={t.id} href={t.href} className={styles.tool}>
                    <span className={styles.toolIcon}><ShellIcon name={t.icon} size={18} /></span>
                    <span className={styles.toolText}><b>{t.name}{t.beta ? <em className={styles.beta}>開発中</em> : null}</b><small>{t.hint}</small></span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
