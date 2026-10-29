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
  COMPANY_METRICS, DECISIONS, DEPT_KUN, DEPT_LABEL, DEPT_REPORTS, FAVORITE_TOOLS, MARKETING_VIEW, MOBILE_ITEMS, SIDEBAR_ITEMS, TODAY_TASKS,
  type Metric, type MobileKey, type NavKey,
} from './model'
import styles from './shell-next.module.css'

const EXAMPLES = ['来週の商談の準備をまとめて進めたい', '20万円の支出を登録したい', 'バナーの新しい案を作りたい']

function toolOf(id: string) {
  return ALL_SHELL_TOOLS.find((t) => t.id === id)
}

export default function DeptShellSample() {
  const [view, setView] = useState<NavKey>('home')
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
            <a key={f.toolId} className={styles.fav} href={t?.href ?? '#'} onClick={(e) => e.preventDefault()}>
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
        {view === 'home' ? <HomeView go={go} /> : null}
        {view === 'marketing' ? <DeptView dept="marketing" /> : null}
        {view === 'sales' || view === 'hr' || view === 'admin' ? <DeptStub dept={view} /> : null}
        {view === 'tools' ? <ToolsView /> : null}
        {view === 'settings' ? <SettingsView /> : null}
      </main>

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

function MetricTile({ m }: { m: Metric }) {
  const arrow = m.delta?.tone === 'up' ? '▲' : m.delta?.tone === 'down' ? '▼' : '―'
  return (
    <div className={styles.metric}>
      <p className={styles.mLabel}>{m.label}</p>
      <p className={styles.mValue}>{m.value}{m.unit ? <span className={styles.mUnit}>{m.unit}</span> : null}</p>
      {m.delta ? <span className={styles.delta} data-good={m.delta.good} data-tone={m.delta.tone}><span aria-hidden="true">{arrow}</span>{m.delta.text}{m.delta.good ? '' : '（要確認）'}</span> : null}
    </div>
  )
}

/* ---- 経営ホーム: 上から ①頼む ②数字 ③判断 ④部署の報告 ⑤今日やること ---- */
function HomeView({ go }: { go: (k: NavKey) => void }) {
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
              <button type="button" className={styles.btn} disabled={!text.trim()}>ドヤAIに頼む</button>
            </div>
          </div>
          <div className={styles.askKun}><DoyaKun pose="point" size={120} /></div>
        </section>
      </Stagger>

      <Stagger i={1}>
        <section className={styles.card} aria-label="今日の経営の数字">
          <div className={styles.cardHead}><h2 className={styles.h2}>今日の経営の数字</h2><span className={styles.pill}>見本の仮の数字</span></div>
          <div className={styles.metrics}>{COMPANY_METRICS.map((m) => <MetricTile key={m.label} m={m} />)}</div>
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
                <button type="button" className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}>{d.action}</button>
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
                  <button type="button" className={`${styles.report} ${styles.item}`} onClick={() => go(r.dept)} style={{ width: '100%' }}>
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
function DeptView({ dept }: { dept: 'marketing' }) {
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
                <a key={m.toolId} className={styles.member} href={t?.href ?? '#'} onClick={(e) => e.preventDefault()}>
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
function ToolsView() {
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
              <a key={t.id} className={styles.member} href={t.href} onClick={(e) => e.preventDefault()}>
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
