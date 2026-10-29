'use client'
// ============================================
// 部署別の枠（見本）。7項目のサイドバー／スマホの下の5つのボタン／経営ホーム／部署のページ
// ============================================
// 2026-10-29 本人の指示（メイン経由）。見本のページ（/shell-sample）だけで使う。本番には出さない。
// ⚠️ 数字・文は見本の仮のもの。画面に「見本の仮の数字」と出す。API・DB・AI・ドヤパワーは使わない。
// ⚠️ 色・書体・ドヤくんの部品は今のドヤAI（ds のトークンと DoyaKun）。動きは位置と透明度だけ。
import { useState } from 'react'
import { DEPARTMENTS, type DepartmentId } from '@/lib/departments'
import { DoyaKun } from '@/components/ds/kun'
import { ToolBearIcon } from '@/components/shell/ToolBearIcon'
import { ShellIcon } from '@/components/shell/icons'
import { ALL_SHELL_TOOLS } from '@/components/shell/tools'
import tokens from '@/components/ds/tokens.module.css'
import {
  COMPANY_METRICS, DECISIONS, DECISION_DETAIL, DEPT_KUN, DEPT_LABEL, DEPT_REPORTS, FAVORITE_TOOLS, MARKETING_VIEW, MOBILE_ITEMS, REPORT_DETAIL, SIDEBAR_ITEMS, TODAY_TASKS,
  metricBreakdown, type Metric, type MobileKey, type NavKey,
} from './model'
import { Panel, usePanelKey } from './Panel'
import { parsePanelKey } from './panel-hash'
import { actionOfTool, demoRoute, type DemoRoute } from './demo-route'
import styles from './shell-next.module.css'

const EXAMPLES = ['来週の商談の準備をまとめて進めたい', '20万円の支出を登録したい', 'バナーの新しい案を作りたい']

function toolOf(id: string) {
  return ALL_SHELL_TOOLS.find((t) => t.id === id)
}

export default function DeptShellSample() {
  const [view, setView] = useState<NavKey>('home')
  // パネル（右から・スマホは下から）。URL のハッシュ（#p=）で開閉し、戻るボタンでパネルだけが閉じる
  const panel = usePanelKey()
  // 「ドヤAIに頼む」の結果（値は URL に載せず、この画面の状態に持つ）
  const [ask, setAsk] = useState<{ text: string; route: DemoRoute | null } | null>(null)
  const sendAsk = (text: string) => { setAsk({ text, route: demoRoute(text) }); panel.open('ask') }
  /** スマホの「部署」ボタンで開く部署（見本では最後に見た部署） */
  const [lastDept, setLastDept] = useState<DepartmentId>('marketing')
  const go = (k: NavKey) => {
    setView(k)
    if (k === 'marketing' || k === 'sales' || k === 'hr' || k === 'admin') setLastDept(k)
    window.scrollTo({ top: 0 })
  }
  const mobileGo = (k: MobileKey) => {
    if (k === 'home') go('home')
    else if (k === 'dept') go(lastDept)
    else if (k === 'ask') { go('home'); requestAnimationFrame(() => document.getElementById('ask-input')?.focus()) }
    else go(k)
  }
  const mobileCurrent: MobileKey = view === 'home' ? 'home' : view === 'tools' ? 'tools' : view === 'settings' ? 'settings' : 'dept'

  return (
    <div className={`${tokens.ds} ${styles.root}`}>
      <aside className={styles.side} aria-label="メニュー">
        <div className={styles.brand}>ドヤAI</div>
        <nav className={styles.nav} aria-label="7つの項目">
          {SIDEBAR_ITEMS.map((it) => (
            <button key={it.key} type="button" className={styles.item} aria-current={view === it.key ? 'page' : undefined} onClick={() => go(it.key)}>
              {it.kun ? (
                <span className={styles.itemKun}><DoyaKun pose={it.kun} size={36} /></span>
              ) : (
                <span className={styles.itemIcon}><ShellIcon name={it.key === 'home' ? 'LayoutDashboard' : it.key === 'tools' ? 'Search' : 'Settings'} size={20} aria-hidden /></span>
              )}
              {it.label}
            </button>
          ))}
        </nav>
        <p className={styles.favTitle}>よく使う</p>
        {FAVORITE_TOOLS.slice(0, 3).map((f) => {
          const t = toolOf(f.toolId)
          return (
            <a key={f.toolId} className={styles.fav} href={t?.href ?? '#'} onClick={(e) => { e.preventDefault(); panel.open(`tool:${f.toolId}`) }}>
              <ToolBearIcon id={f.toolId} icon={t?.icon} size={28} iconSize={16} />
              {f.name}
            </a>
          )
        })}
        <p className={styles.foot}>最近使ったツールから自動で並びます</p>
        <div className={styles.sideBottom}><p className={styles.sample}>見本です。数字はすべて仮のものです</p></div>
      </aside>

      <main className={styles.main} id="main">
        <p className={`${styles.sample} ${styles.sampleTop}`}>見本です。数字はすべて仮のものです</p>
        {view === 'home' ? <HomeView go={go} open={panel.open} onAsk={sendAsk} /> : null}
        {view === 'marketing' ? <DeptView dept="marketing" open={panel.open} /> : null}
        {view === 'sales' || view === 'hr' || view === 'admin' ? <DeptStub dept={view} /> : null}
        {view === 'tools' ? <ToolsView open={panel.open} /> : null}
        {view === 'settings' ? <SettingsView /> : null}
      </main>

      <PanelHost panelKey={panel.key} onClose={panel.close} ask={ask} go={(k) => { panel.close(); go(k) }} />

      <nav className={styles.tabbar} aria-label="下のメニュー">
        {MOBILE_ITEMS.map((m) => (
          <button key={m.key} type="button" className={`${styles.tab} ${m.key === 'ask' ? styles.tabAsk : ''}`} aria-current={mobileCurrent === m.key ? 'page' : undefined} onClick={() => mobileGo(m.key)}>
            {m.key === 'dept' ? <DoyaKun pose={DEPT_KUN[lastDept]} size={26} /> : <ShellIcon name={m.key === 'home' ? 'LayoutDashboard' : m.key === 'ask' ? 'Sparkles' : m.key === 'tools' ? 'Search' : 'Settings'} size={22} aria-hidden />}
            {m.label}
          </button>
        ))}
      </nav>
    </div>
  )
}

function Stagger({ i, children }: { i: number; children: React.ReactNode }) {
  return <div className={styles.in} style={{ ['--i' as string]: i }}>{children}</div>
}

function MetricTile({ m, onOpen }: { m: Metric; onOpen?: () => void }) {
  const arrow = m.delta?.tone === 'up' ? '▲' : m.delta?.tone === 'down' ? '▼' : '―'
  const Tag = onOpen ? 'button' : 'div'
  return (
    <Tag className={`${styles.metric} ${onOpen ? styles.clickable : ''}`} {...(onOpen ? { type: 'button' as const, onClick: onOpen, 'aria-label': `${m.label}の詳しい内容を開く` } : {})}>
      <p className={styles.mLabel}>{m.label}</p>
      <p className={styles.mValue}>{m.value}{m.unit ? <span className={styles.mUnit}>{m.unit}</span> : null}</p>
      {m.delta ? <span className={styles.delta} data-good={m.delta.good} data-tone={m.delta.tone}><span aria-hidden="true">{arrow}</span>{m.delta.text}{m.delta.good ? '' : '（要確認）'}</span> : null}
    </Tag>
  )
}

/* ---- 経営ホーム: 上から ①頼む ②数字 ③判断 ④部署の報告 ⑤今日やること ---- */
function HomeView({ go, open, onAsk }: { go: (k: NavKey) => void; open: (key: string) => void; onAsk: (text: string) => void }) {
  const [text, setText] = useState('')
  return (
    <div className={styles.stack}>
      <Stagger i={0}>
        <section className={`${styles.card} ${styles.ask}`} aria-label="ドヤAIに頼む">
          <div className={styles.askBox}>
            <h1 className={styles.askTitle}>今日は、何をしますか？</h1>
            <textarea id="ask-input" className={styles.textarea} value={text} onChange={(e) => setText(e.target.value)} placeholder="例: 来週の商談の準備をまとめて進めたい" rows={2} />
            <div className={styles.btnRow}>
              <div className={styles.chips}>{EXAMPLES.map((e) => <button key={e} type="button" className={styles.chip} onClick={() => setText(e)}>{e}</button>)}</div>
              <button type="button" className={styles.btn} disabled={!text.trim()} onClick={() => onAsk(text.trim())}>ドヤAIに頼む</button>
            </div>
          </div>
          <div className={styles.askKun}><DoyaKun pose="point" size={120} /></div>
        </section>
      </Stagger>

      <Stagger i={1}>
        <section className={styles.card} aria-label="今日の経営の数字">
          <div className={styles.cardHead}><h2 className={styles.h2}>今日の経営の数字</h2><span className={styles.pill}>見本の仮の数字</span></div>
          <div className={styles.metrics}>{COMPANY_METRICS.map((m, i) => <MetricTile key={m.label} m={m} onOpen={() => open(`metric:${i}`)} />)}</div>
        </section>
      </Stagger>

      <Stagger i={2}>
        <section className={styles.card} aria-label="あなたの判断が必要なこと">
          <div className={styles.cardHead}><h2 className={styles.h2}>あなたの判断が必要なこと</h2><span className={styles.sub}>{DECISIONS.length}件</span></div>
          <ul className={styles.list}>
            {DECISIONS.map((d) => (
              <li key={d.id} className={styles.row}>
                <DoyaKun pose={DEPT_KUN[d.dept]} size={40} />
                <div><p className={styles.rowTitle}>{d.title}</p><p className={styles.rowText}>{d.detail}</p></div>
                <button type="button" className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`} onClick={() => open(`decision:${d.id}`)}>{d.action}</button>
              </li>
            ))}
          </ul>
        </section>
      </Stagger>

      <div className={styles.cols}>
        <Stagger i={3}>
          <section className={styles.card} aria-label="各部署からの報告">
            <div className={styles.cardHead}><h2 className={styles.h2}>各部署からの報告</h2></div>
            <ul className={styles.list}>
              {DEPT_REPORTS.map((r) => (
                <li key={r.dept}>
                  <button type="button" className={`${styles.report} ${styles.item}`} onClick={() => open(`report:${r.dept}`)} style={{ width: '100%' }}>
                    <span className={styles.reportKun}><DoyaKun pose={DEPT_KUN[r.dept]} size={48} /></span>
                    <span><span className={styles.rowTitle} style={{ display: 'block' }}>{DEPT_LABEL[r.dept]}</span><span className={styles.rowText} style={{ display: 'block' }}>{r.line}</span></span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </Stagger>
        <Stagger i={4}>
          <section className={styles.card} aria-label="今日やること">
            <div className={styles.cardHead}><h2 className={styles.h2}>今日やること</h2><span className={styles.sub}>{TODAY_TASKS.length}件</span></div>
            <ul className={styles.list}>
              {TODAY_TASKS.map((t) => (
                <li key={t.id} className={styles.row} style={{ gridTemplateColumns: 'auto minmax(0, 1fr) auto' }}>
                  <span className={styles.dot} aria-hidden="true" />
                  <p className={styles.rowTitle}>{t.text}</p>
                  <span className={styles.tag}>{DEPT_LABEL[t.dept]}</span>
                </li>
              ))}
            </ul>
          </section>
        </Stagger>
      </div>
    </div>
  )
}

/* ---- 部署のページ（マーケ部） ---- */
function DeptView({ dept, open }: { dept: 'marketing'; open: (key: string) => void }) {
  const v = MARKETING_VIEW
  const [answer, setAnswer] = useState<null | 'yes' | 'later'>(null)
  return (
    <div className={styles.stack}>
      <Stagger i={0}>
        <div className={styles.deptHead}>
          <DoyaKun pose={DEPT_KUN[dept]} size={96} act="cheer" className={styles.deptKun} />
          <div>
            <p className={styles.sub}>ドヤマーケAI</p>
            <h1 className={styles.deptTitle}>{DEPT_LABEL[dept]}</h1>
          </div>
        </div>
      </Stagger>
      <Stagger i={1}>
        <section className={styles.card} aria-label="部署の数字">
          <div className={styles.cardHead}><h2 className={styles.h2}>部署の数字</h2><span className={styles.pill}>見本の仮の数字</span></div>
          <div className={styles.metrics}>{v.metrics.map((m) => <MetricTile key={m.label} m={m} />)}</div>
        </section>
      </Stagger>
      <Stagger i={2}>
        <section className={`${styles.card} ${styles.proposal}`} aria-label="部署のドヤくんからの提案">
          <DoyaKun pose="ponder" act="think" size={88} />
          <div>
            <p className={styles.sub}>部署長のドヤくんからの提案</p>
            {answer === null ? (
              <>
                <p className={styles.proposalText}>{v.proposal.text}</p>
                <div className={styles.btnRow} style={{ justifyContent: 'flex-start' }}>
                  <button type="button" className={styles.btn} onClick={() => setAnswer('yes')}>{v.proposal.primary}</button>
                  <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => setAnswer('later')}>{v.proposal.secondary}</button>
                </div>
              </>
            ) : (
              <p className={styles.proposalText}>{answer === 'yes' ? '分かりました。バナーAI の画面を、先週いちばん反応が良かった案を入れた状態で開きます（見本では開きません）。' : 'あとで、もう一度お知らせします。'}</p>
            )}
          </div>
        </section>
      </Stagger>
      <Stagger i={3}>
        <section className={styles.card} aria-label="部員（ツール）">
          <div className={styles.cardHead}><h2 className={styles.h2}>部員（ツール）</h2><span className={styles.sub}>{v.members.length}人</span></div>
          <div className={styles.members}>
            {v.members.map((m) => {
              const t = toolOf(m.toolId)
              return (
                <a key={m.toolId} className={styles.member} href={t?.href ?? '#'} onClick={(e) => { e.preventDefault(); open(`tool:${m.toolId}`) }}>
                  <ToolBearIcon id={m.toolId} icon={t?.icon} size={40} iconSize={20} />
                  <span><span className={styles.rowTitle} style={{ display: 'block' }}>{m.name}</span><span className={styles.rowText} style={{ display: 'block' }}>{m.hint}</span></span>
                </a>
              )
            })}
          </div>
        </section>
      </Stagger>
      <Stagger i={4}>
        <section className={styles.card} aria-label="最近つくったもの">
          <div className={styles.cardHead}><h2 className={styles.h2}>最近つくったもの</h2></div>
          <ul className={styles.list}>
            {v.recent.map((r) => (
              <li key={r.id} className={styles.row} style={{ gridTemplateColumns: 'minmax(0, 1fr) auto' }}>
                <p className={styles.rowTitle}>{r.what}</p>
                <span className={styles.sub}>{r.when}</span>
              </li>
            ))}
          </ul>
        </section>
      </Stagger>
    </div>
  )
}

/** ほかの部署は、見本では1つめ（マーケ部）と同じ作りになる、とだけ出す */
function DeptStub({ dept }: { dept: DepartmentId }) {
  const d = DEPARTMENTS.find((x) => x.id === dept)!
  return (
    <div className={styles.stack}>
      <Stagger i={0}>
        <div className={styles.deptHead}>
          <DoyaKun pose={DEPT_KUN[dept]} size={96} act="cheer" className={styles.deptKun} />
          <div><p className={styles.sub}>{d.name}</p><h1 className={styles.deptTitle}>{DEPT_LABEL[dept]}</h1></div>
        </div>
      </Stagger>
      <Stagger i={1}>
        <section className={styles.card}>
          <p className={styles.proposalText}>見本では、マーケ部だけを作りました。{DEPT_LABEL[dept]}も、同じ作り（部署の数字・部署長のドヤくんの提案・部員のカード・最近つくったもの）になります。</p>
        </section>
      </Stagger>
    </div>
  )
}

/* ---- 道具箱（全ツールの検索）・設定 ---- */
function ToolsView({ open }: { open: (key: string) => void }) {
  const [q, setQ] = useState('')
  const list = ALL_SHELL_TOOLS.filter((t) => t.id !== 'home' && (t.name + t.hint).toLowerCase().includes(q.trim().toLowerCase()))
  return (
    <div className={styles.stack}>
      <Stagger i={0}>
        <section className={styles.card}>
          <div className={styles.cardHead}><h1 className={styles.h2}>道具箱</h1><span className={styles.sub}>{list.length}ツール</span></div>
          <input className={styles.textarea} style={{ minHeight: 44, marginBottom: 14 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="ツールを探す（例: バナー、見積）" aria-label="ツールを探す" />
          <div className={styles.tools}>
            {list.map((t) => (
              <a key={t.id} className={styles.member} href={t.href} onClick={(e) => { e.preventDefault(); open(`tool:${t.id}`) }}>
                <ToolBearIcon id={t.id} icon={t.icon} size={40} iconSize={20} />
                <span><span className={styles.rowTitle} style={{ display: 'block' }}>{t.name}</span><span className={styles.rowText} style={{ display: 'block' }}>{t.hint}</span></span>
              </a>
            ))}
          </div>
        </section>
      </Stagger>
    </div>
  )
}

function SettingsView() {
  return (
    <div className={styles.stack}>
      <Stagger i={0}>
        <section className={styles.card}>
          <div className={styles.cardHead}><h1 className={styles.h2}>設定</h1></div>
          <p className={styles.proposalText}>見本では、設定の中身は作っていません（会社情報・主に使う部署・知らせの量・料金プランが入ります）。</p>
        </section>
      </Stagger>
    </div>
  )
}

/* ============ パネルの中身 ============ */
function PanelHost({ panelKey, onClose, ask, go }: { panelKey: string | null; onClose: () => void; ask: { text: string; route: DemoRoute | null } | null; go: (k: NavKey) => void }) {
  const ref = parsePanelKey(panelKey)
  // 閉じる動きのあいだ、中身が消えないよう、最後に開いたものを覚えておく
  const [last, setLast] = useState<ReturnType<typeof parsePanelKey>>(null)
  if (ref && (!last || last.kind !== ref.kind || last.id !== ref.id)) setLast(ref)
  const shown = ref ?? last
  let title = ''
  let subtitle: string | undefined
  let body: React.ReactNode = null
  if (shown?.kind === 'metric') {
    const m = COMPANY_METRICS[Number(shown.id)]
    if (m) { title = m.label; subtitle = '見本の仮の数字'; body = <MetricPanel m={m} onClose={onClose} /> }
  } else if (shown?.kind === 'decision') {
    const d = DECISIONS.find((x) => x.id === shown.id)
    if (d) { title = d.title; subtitle = DEPT_LABEL[d.dept]; body = <DecisionPanel id={d.id} detail={d.detail} onClose={onClose} /> }
  } else if (shown?.kind === 'report') {
    const dept = DEPARTMENTS.find((x) => x.id === shown.id)
    if (dept) { title = `${DEPT_LABEL[dept.id]}からの報告`; subtitle = '部署長のドヤくん'; body = <ReportPanel dept={dept.id} go={go} /> }
  } else if (shown?.kind === 'tool') {
    const t = ALL_SHELL_TOOLS.find((x) => x.id === shown.id)
    if (t) { title = t.name; subtitle = '簡単な入力で頼めます'; body = <ToolPanel key={t.id} toolId={t.id} onClose={onClose} /> }
  } else if (shown?.kind === 'ask' && ask) {
    title = ask.route ? ask.route.action.label : 'ドヤAIの答え'
    subtitle = 'ドヤAIが選びました'
    body = <AskPanel key={ask.text} ask={ask} onClose={onClose} />
  }
  return <Panel open={Boolean(ref && body)} onClose={onClose} title={title} subtitle={subtitle}>{body}</Panel>
}

function MetricPanel({ m, onClose }: { m: Metric; onClose: () => void }) {
  const rows = metricBreakdown(m.label)
  return (
    <>
      <div className={styles.metric} style={{ pointerEvents: 'none' }}>
        <p className={styles.mValue}>{m.value}{m.unit ? <span className={styles.mUnit}>{m.unit}</span> : null}</p>
        {m.delta ? <span className={styles.delta} data-good={m.delta.good} data-tone={m.delta.tone}>{m.delta.text}</span> : null}
      </div>
      <div className={styles.field}>
        <span className={styles.fieldLabel}>内訳</span>
        {rows.map((r) => (
          <div key={r.name} className={styles.bar}>
            <span>{r.name}</span>
            <span className={styles.barTrack}><span className={styles.barFill} style={{ width: `${r.value}%` }} /></span>
            <span>{r.text}</span>
          </div>
        ))}
      </div>
      <p className={styles.note}>この画面は見本です。数字は仮のものです。</p>
      <div className={styles.panelFoot}>
        <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={onClose}>閉じる</button>
        <button type="button" className={styles.btn} onClick={onClose}>全部の画面を開く</button>
      </div>
    </>
  )
}

function DecisionPanel({ id, detail, onClose }: { id: string; detail: string; onClose: () => void }) {
  const d = DECISION_DETAIL[id]
  const [done, setDone] = useState<null | 'primary' | 'secondary'>(null)
  return (
    <>
      <p className={styles.read}>{d?.lines.map((l) => <span key={l}>{l}</span>) ?? detail}</p>
      {done ? <p className={styles.ok}>{done === 'primary' ? `「${d?.primary}」を押しました（見本のため、何も送られません）。` : 'あとで、もう一度お知らせします。'}</p> : null}
      <div className={styles.panelFoot}>
        <button type="button" className={styles.btn} onClick={() => setDone('primary')}>{d?.primary ?? '進める'}</button>
        <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => (done ? onClose() : setDone('secondary'))}>{done ? '閉じる' : d?.secondary ?? 'あとで'}</button>
      </div>
    </>
  )
}

function ReportPanel({ dept, go }: { dept: DepartmentId; go: (k: NavKey) => void }) {
  const r = REPORT_DETAIL[dept]
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <DoyaKun pose={DEPT_KUN[dept]} size={72} act="cheer" />
        <p className={styles.proposalText} style={{ margin: 0 }}>{DEPT_REPORTS.find((x) => x.dept === dept)?.line}</p>
      </div>
      <ul className={styles.list}>{r.points.map((p) => <li key={p} className={styles.read}>{p}</li>)}</ul>
      <div className={styles.panelFoot}>
        <button type="button" className={styles.btn}>{r.next}</button>
        <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={() => go(dept)}>{DEPT_LABEL[dept]}のページを開く</button>
      </div>
    </>
  )
}

/** ツールのカードを押したときの、簡単な入力のパネル（そのツールの最初の操作の欄）。全部の画面が要るときだけ「開く」で移る */
function ToolPanel({ toolId, onClose }: { toolId: string; onClose: () => void }) {
  const tool = ALL_SHELL_TOOLS.find((t) => t.id === toolId)
  const action = actionOfTool(toolId)
  const [vals, setVals] = useState<Record<string, string>>({})
  const [done, setDone] = useState(false)
  const missing = action?.fields.filter((f) => f.required && !vals[f.key]?.trim()) ?? []
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <ToolBearIcon id={toolId} icon={tool?.icon} size={48} iconSize={24} />
        <p className={styles.proposalText} style={{ margin: 0 }}>{tool?.lead ?? tool?.hint}</p>
      </div>
      {action ? (
        <>
          <p className={styles.sub} style={{ margin: 0 }}>{action.label}</p>
          {action.fields.length === 0 ? <p className={styles.note}>このツールは、全部の画面で進めます。</p> : null}
          {action.fields.map((f, i) => (
            <label key={f.key} className={styles.field}>
              <span className={styles.fieldLabel}>{f.label}{f.required ? '（必須）' : '（あとで入れてもよい）'}</span>
              <input className={styles.input} value={vals[f.key] ?? ''} onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value }))} placeholder={f.ask} {...(i === 0 ? { 'data-autofocus': true } : {})} />
            </label>
          ))}
        </>
      ) : null}
      {done ? <p className={styles.ok}>頼みました（見本のため、何も作りません）。本物では、ここで結果が出て、保存の直前まで進みます。</p> : null}
      <div className={styles.panelFoot}>
        <button type="button" className={styles.btn} disabled={missing.length > 0 || done} onClick={() => setDone(true)}>ここで頼む</button>
        <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={onClose}>全部の画面を開く</button>
      </div>
      {missing.length ? <p className={styles.fieldHint}>{missing.map((f) => f.label).join('・')}を入れると頼めます</p> : null}
    </>
  )
}

/** 「ドヤAIに頼む」の結果: AI が選んだ操作と、読み取った値を入れた入力を、パネルの中で確かめ、保存の直前まで進める */
function AskPanel({ ask, onClose }: { ask: { text: string; route: DemoRoute | null }; onClose: () => void }) {
  const route = ask.route
  const [vals, setVals] = useState<Record<string, string>>(route?.values ?? {})
  const [done, setDone] = useState(false)
  if (!route) {
    return (
      <>
        <p className={styles.read}><span>「{ask.text}」</span><span>見本では、この依頼に合う操作を選べませんでした。本物では、近い操作の案を出し、行き止まりにしません。</span></p>
        <div className={styles.panelFoot}><button type="button" className={styles.btn} onClick={onClose}>依頼を書き直す</button></div>
      </>
    )
  }
  const a = route.action
  const tool = ALL_SHELL_TOOLS.find((t) => t.id === a.toolId)
  const missing = a.fields.filter((f) => f.required && !vals[f.key]?.trim())
  const got = a.fields.filter((f) => route.values[f.key])
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <ToolBearIcon id={a.toolId} icon={tool?.icon} size={48} iconSize={24} />
        <p className={styles.proposalText} style={{ margin: 0 }}>{tool?.name} の「{a.label}」で進めます。</p>
      </div>
      <p className={styles.read}>
        <span>あなたの依頼: 「{ask.text}」</span>
        {got.length ? <span>読み取った内容: {got.map((f) => `${f.label} ${f.type === 'yen' ? `${Number(route.values[f.key]).toLocaleString('ja-JP')}円` : route.values[f.key]}`).join('、')}</span> : <span>読み取れた値は、まだありません。</span>}
      </p>
      {a.fields.map((f, i) => (
        <label key={f.key} className={styles.field}>
          <span className={styles.fieldLabel}>{f.label}{f.required ? '（必須）' : ''}</span>
          <input className={styles.input} value={vals[f.key] ?? ''} onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value }))} data-missing={f.required && !vals[f.key]?.trim() ? 'true' : undefined} placeholder={f.ask} {...(i === 0 ? { 'data-autofocus': true } : {})} />
          {f.required && !vals[f.key]?.trim() ? <span className={styles.fieldHint}>{f.ask ?? `${f.label}を教えてください`}</span> : null}
        </label>
      ))}
      {done ? <p className={styles.ok}>「{a.finalStep}」の直前まで進みました。見本のため、保存はしません。本物では、内容を確かめて、押すのはあなたです。</p> : null}
      <div className={styles.panelFoot}>
        <button type="button" className={styles.btn} disabled={missing.length > 0 || done} onClick={() => setDone(true)}>{a.finalStep.replace(/[「」]/g, '')}</button>
        <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={onClose}>全部の画面を開く</button>
      </div>
      <p className={styles.note}>見本では、言葉の一致で操作を選びます。本物は AI が、全ツールの操作から選びます。</p>
    </>
  )
}
