'use client'
// ⚠️ 新しい見た目（isUiNext()）でない人に出す、今までの経営ホーム。プレビューの切り替え（UI-QUALITY-CHECKLIST §5.1）が全員に出たら消す。
// ============================================
// 経営ホーム 画面本体
// ============================================
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowRight, Send, StopCircle, CheckCircle2, Loader2, RefreshCw, TrendingUp, Wallet, FileText, FolderKanban,
  Clock, Users, CreditCard, AlertTriangle, ChevronLeft, ChevronRight,
} from 'lucide-react'
import type { HomeSummary, HomeEvent } from '@/lib/home/summary'
import { shellGroups } from '@/components/shell/tools'
import { ShellIcon } from '@/components/shell/icons'
import { AGENT_SUGGESTIONS, planAgent, type AgentPlan } from './agent'
import { homeContractDate, homeJstDateKey, homeSnapshotClock } from './clock'
import FinanceOverview, { FinanceBillingTasks } from './FinanceOverview'
import PopupOverview from './PopupOverview'
import SavedTenjikaiOverview from './SavedTenjikaiOverview'
import HomeActorBoundary, { type HomeActorView } from './HomeActorBoundary'
import styles from './home-legacy.module.css'

const man = (n: number) => {
  if (Math.abs(n) >= 100_000_000) return `${(Math.round(n / 10_000_000) / 10).toLocaleString('ja-JP')}億円`
  if (Math.abs(n) >= 10_000) return `${(Math.round(n / 1000) / 10).toLocaleString('ja-JP')}万円`
  return `${Math.round(n).toLocaleString('ja-JP')}円`
}

const STEP_MS = 520

/** API 経由のリダイレクト（決済ポータル等）は画面遷移ではなく通常のリンクで開く */
function SmartLink({ href, className, children, current }: { href: string; className?: string; children: React.ReactNode; current: () => boolean }) {
  const guard = (event: React.MouseEvent) => { if (!current()) { event.preventDefault(); event.stopPropagation() } }
  if (href.startsWith('/api/')) return <a href={href} className={className} onClick={guard}>{children}</a>
  return <Link href={href} className={className} onClick={guard}>{children}</Link>
}

/* ---------------- エージェント ---------------- */

type RunState = { plan: AgentPlan; query: string; shown: number; status: 'running' | 'done' | 'stopped' }

function AgentPanel({ summary, current }: { summary: HomeSummary; current: () => boolean }) {
  const [input, setInput] = useState('')
  const [run, setRun] = useState<RunState | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clear = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null } }
  useEffect(() => clear, [])

  const start = useCallback((query: string) => {
    if (!current()) return
    const q = query.trim()
    if (!q) return
    clear()
    const plan = planAgent(q, summary)
    setRun({ plan, query: q, shown: 0, status: 'running' })
    setInput('')
  }, [summary, current])

  useEffect(() => {
    if (!current() || !run || run.status !== 'running') return
    if (run.shown >= run.plan.steps.length) {
      setRun((r) => (r ? { ...r, status: 'done' } : r))
      return
    }
    timer.current = setTimeout(() => setRun((r) => (current() && r && r.status === 'running' ? { ...r, shown: r.shown + 1 } : r)), STEP_MS)
    return clear
  }, [run, current])

  const stop = () => { if (!current()) return; clear(); setRun((r) => (r ? { ...r, status: 'stopped' } : r)) }

  return (
    <section className={styles.agent} aria-label="経営エージェント">
      <form
        className={styles.ask}
        onSubmit={(e) => { e.preventDefault(); start(input) }}
      >
        <input
          className={styles.askInput}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="やりたいことを入力してください（例: 今月の売上と収入を教えて）"
          aria-label="エージェントへの依頼"
          maxLength={200}
        />
        <button type="submit" className={styles.askButton} disabled={!input.trim()} aria-label="依頼する">
          <Send size={18} />
        </button>
      </form>
      <div className={styles.chips}>
        {AGENT_SUGGESTIONS.map((s) => (
          <button key={s} type="button" className={styles.chip} onClick={() => start(s)}>{s}</button>
        ))}
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
                    <SmartLink key={a.label} href={a.href} className={styles.action} current={current}>
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

function Kpi({ icon: Icon, label, value, sub, href, muted }: { icon: typeof Wallet; label: string; value: string; sub?: string; href: string; muted?: boolean }) {
  return (
    <Link href={href} className={styles.kpi} data-muted={muted ? 'true' : undefined}>
      <span className={styles.kpiIcon}><Icon size={18} /></span>
      <span className={styles.kpiLabel}>{label}</span>
      <span className={styles.kpiValue}>{value}</span>
      {sub ? <span className={styles.kpiSub}>{sub}</span> : null}
    </Link>
  )
}

/* ---------------- 月次推移 ---------------- */

function TrendChart({ trend }: { trend: HomeSummary['trend'] }) {
  const max = Math.max(1, ...trend.flatMap((p) => [p.won, p.quoted]))
  const W = 560, H = 200, P = 28
  const bw = (W - P * 2) / trend.length
  const y = (v: number) => H - P - (v / max) * (H - P * 2)
  const line = trend.map((p, i) => `${i === 0 ? 'M' : 'L'}${P + bw * i + bw / 2},${y(p.quoted)}`).join(' ')
  const empty = trend.every((p) => p.won === 0 && p.quoted === 0)
  return (
    <div className={styles.chartWrap}>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.chart} role="img" aria-label="直近6か月の受注額と確定見積額">
        {[0.25, 0.5, 0.75, 1].map((t) => (
          <line key={t} x1={P} x2={W - P} y1={y(max * t)} y2={y(max * t)} className={styles.grid} />
        ))}
        {trend.map((p, i) => (
          <g key={p.month}>
            <rect
              x={P + bw * i + bw * 0.22}
              y={y(p.won)}
              width={bw * 0.56}
              height={Math.max(0, H - P - y(p.won))}
              rx={6}
              className={styles.bar}
            >
              <title>{`${p.month} 受注 ${man(p.won)}`}</title>
            </rect>
            <text x={P + bw * i + bw / 2} y={H - 8} className={styles.axis} textAnchor="middle">{Number(p.month.slice(5))}月</text>
          </g>
        ))}
        <path d={line} className={styles.line} />
        {trend.map((p, i) => (
          <circle key={p.month} cx={P + bw * i + bw / 2} cy={y(p.quoted)} r={3.5} className={styles.point}>
            <title>{`${p.month} 確定見積 ${man(p.quoted)}`}</title>
          </circle>
        ))}
      </svg>
      <div className={styles.legend}>
        <span><i className={styles.legendBar} />受注（営業管理）</span>
        <span><i className={styles.legendLine} />確定見積（税抜）</span>
      </div>
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
      <ul className={styles.funnel}>
        {sales.stages.map((s) => (
          <li key={s.name}>
            <div className={styles.funnelHead}>
              <span>{s.name}</span>
              <span className={styles.funnelValue}>{s.count}件 ・ {man(s.amount)}</span>
            </div>
            <div className={styles.funnelTrack}>
              <div className={styles.funnelFill} style={{ width: `${Math.max(2, (s.amount / max) * 100)}%`, background: s.color }} />
            </div>
          </li>
        ))}
      </ul>
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

function MiniCalendar({ events, today }: { events: HomeEvent[]; today: string }) {
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
      const k = homeJstDateKey(e.date)
      if (!k) return
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

function EmptyCard({ text, href, cta }: { text: string; href: string; cta: string }) {
  return (
    <div className={styles.emptyCard}>
      <p>{text}</p>
      <Link href={href} className={styles.action}>{cta} <ArrowRight size={15} /></Link>
    </div>
  )
}

/* ---------------- 本体 ---------------- */

export default function HomeDashboardLegacy({ initial, serverActorId }: { initial: HomeSummary; serverActorId: string }) {
  return <HomeActorBoundary initial={initial} serverActorId={serverActorId}>{view => <HomeDashboardLegacyView {...view} />}</HomeActorBoundary>
}

function HomeDashboardLegacyView({ summary, loading, error, refresh, current }: HomeActorView) {
  const s = summary
  const c = s.contract
  const clock = homeSnapshotClock(s.generatedAt)
  // 数字の出所（ADDON-SERVICES §4）。収入管理・支出管理を使っている組織では、そちらが正本になる
  const revenueSource = s.sources.revenue === 'income' ? '収入管理' : s.sources.revenue === 'unavailable' ? '未取得' : '営業管理・見積（参考）'
  const costSource = s.sources.cost === 'expense' ? '支出管理' : s.sources.cost === 'unavailable' ? '未取得' : 'プロマネ（案件経費・人件費の参考値）'
  const useLegacyRevenue = !s.finance || s.finance.income.state === 'unused'
  const periodEnd = homeContractDate(c.currentPeriodEnd)

  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>経営ホーム</p>
          <h1 className={styles.title}>{clock.greeting}{s.user.name ? `、${s.user.name}さん` : ''}</h1>
          <p className={styles.subtitle}>売上・収入・予定・人の状態を、全ツールからまとめています。</p>
          <p className={styles.sources}>売上は{revenueSource}、支出は{costSource}の数字です。</p>
        </div>
        <button type="button" className={styles.refresh} onClick={refresh} disabled={loading}>
          <RefreshCw size={15} className={loading ? styles.spin : undefined} /> {clock.updated} 時点
        </button>
      </header>
      {error ? <p className={styles.error} role="alert">{error}</p> : null}

      <AgentPanel summary={s} current={current} />

      {s.finance ? <FinanceOverview finance={s.finance} /> : null}
      <PopupOverview popup={s.popup} />
      <SavedTenjikaiOverview tenjikai={s.tenjikai} />
      <FinanceBillingTasks finance={s.finance} />
      {useLegacyRevenue ? (<section className={styles.kpis} aria-label="今月の主要な数字">
        <Kpi icon={TrendingUp} label="今月の受注" value={s.sales.state === 'ready' ? man(s.sales.wonThisMonth) : '—'} sub={s.sales.state === 'ready' ? `${s.sales.wonCountThisMonth}件` : '営業管理が未使用'} href={s.sales.href} muted={s.sales.state !== 'ready'} />
        <Kpi icon={FileText} label="今月確定した見積" value={s.quotes.state === 'ready' ? man(s.quotes.confirmedThisMonth) : '—'} sub={s.quotes.state === 'ready' ? `下書き ${s.quotes.draftCount}件` : '見積が未使用'} href={s.quotes.href} muted={s.quotes.state !== 'ready'} />
        <Kpi icon={Wallet} label="受注見込み（確度で加重）" value={s.sales.state === 'ready' ? man(s.sales.weightedPipeline) : '—'} sub={s.sales.state === 'ready' ? `進行中 ${s.sales.openDeals}件 / ${man(s.sales.openPipeline)}` : undefined} href={s.sales.state === 'ready' ? `${s.sales.href}/deals` : '/sfa'} muted={s.sales.state !== 'ready'} />
        {!s.finance || s.finance.expense.state === 'unused' ? (<Kpi icon={FolderKanban} label="プロジェクト利益" value={s.projects.state === 'ready' ? man(s.projects.profit) : '—'} sub={s.projects.state === 'ready' ? `売上 ${man(s.projects.revenue)} ・ 原価 ${man(s.projects.cost)}` : 'プロマネが未使用'} href={s.projects.href} muted={s.projects.state !== 'ready'} />) : null}
      </section>) : null}

      <div className={styles.gridWide} data-single={!useLegacyRevenue ? 'true' : undefined}>
        {useLegacyRevenue ? (<section className={styles.card}>
          <div className={styles.cardHead}>
            <h2>営業の推移（参考）</h2>
            <span className={styles.cardMeta}>直近6か月</span>
          </div>
          <TrendChart trend={s.trend} />
        </section>) : null}
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2>パイプライン（営業管理・参考）</h2>
            {s.sales.state === 'ready' ? <Link href={`${s.sales.href}/deals`} className={styles.cardLink}>開く</Link> : null}
          </div>
          <Pipeline sales={s.sales} />
        </section>
      </div>

      <div className={styles.gridWide}>
        <section className={styles.card}>
          <div className={styles.cardHead}><h2>カレンダー</h2><span className={styles.badge}>仮</span></div>
          {clock.today ? <MiniCalendar key={clock.today} events={s.events} today={clock.today} /> : <p className={styles.muted}>日付を取得できませんでした。最新の数字を取得してください。</p>}
        </section>
        <section className={styles.card}>
          <div className={styles.cardHead}><h2>案件別収支（プロマネ・参考）</h2>{s.projects.state === 'ready' ? <Link href={s.projects.href} className={styles.cardLink}>レポート</Link> : null}</div>
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
          ) : <EmptyCard text="打刻と残業をここでまとめます。" href="/kintai/dashboard" cta="勤怠をはじめる" />}
        </section>
        <section className={styles.card}>
          <div className={styles.cardHead}><h2><Users size={16} /> 人と組織</h2></div>
          {s.people.state === 'ready' ? (
            <dl className={styles.stats}>
              <div><dt>在籍者</dt><dd>{s.people.activeEmployees}名</dd></div>
              <div><dt>部署</dt><dd>{s.people.departments}</dd></div>
            </dl>
          ) : <EmptyCard text="社員・部署・評価をここでまとめます。" href="/hr/dashboard" cta="人事をはじめる" />}
        </section>
        <section className={styles.card}>
          <div className={styles.cardHead}><h2><CreditCard size={16} /> ご契約</h2></div>
          <dl className={styles.stats}>
            <div><dt>プラン</dt><dd>{c.label}</dd></div>
            <div><dt>状態</dt><dd>{c.cancelAtPeriodEnd ? '期間終了で解約予定' : c.paid ? '契約中' : '無料'}</dd></div>
            {periodEnd ? <div><dt>{c.cancelAtPeriodEnd ? '利用できる期限' : '次回更新日'}</dt><dd>{periodEnd}</dd></div> : null}
          </dl>
          <SmartLink href={c.paid ? '/api/stripe/portal?returnTo=/home' : '/pricing'} className={styles.cardLink} current={current}>
            {c.paid ? '契約内容・お支払い方法を確認' : '料金プランを見る'}
          </SmartLink>
        </section>
      </div>

      <section className={styles.card}>
        <div className={styles.cardHead}><h2>すべてのツール</h2></div>
        <div className={styles.toolGroups}>
          {shellGroups(false).map((g) => (
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
