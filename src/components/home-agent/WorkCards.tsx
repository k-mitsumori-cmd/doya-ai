'use client'
// ============================================
// ドヤくんが作った物のカード（完成の画面・経営ホームの直近・/home/work の一覧で共通）
// ============================================
// 2026-11-01 本人の指示「完成したらそのタスクを表示して何ができていたかめっちゃ分かるように」。
// - 中身は保存した下書きの値（AgentTaskResult の detail と points）だけから出す。作り物の例を出さない。
// - カードを押すと広がって全体が見え、「ツールで開く」で各ツールの画面へ移る。
// - ツールの絵は TodoBear（public/shell/bear/todo/<ツールid>.webp。作り方は docs/design/images/goal-todo/PROMPTS.md）。
import Link from 'next/link'
import { useEffect, useId, useState } from 'react'
import type { AgentDraftDetail } from '@/lib/agent-orchestration/types'
import { BEAR_TOOL_IDS } from '@/components/shell/ToolBearIcon'
import { readWorkItems, WORK_STATUS_LABEL, workTime, type WorkItem } from './history'
import styles from './work.module.css'

/**
 * ToDo の左に出す、ツールの仕事をしているドヤくんの絵（2026-11-01 本人の指示「クマのアイコンをそれぞれ画像生成して分かりやすく」）。
 * 絵の無いツールは、左のメニューと同じ全身の絵（public/shell/bear/<ツールid>.webp）、それも無ければ何も出さない枠。
 * 新しいツールを作戦に足したら、同じ型で絵を作って TODO_BEARS に足す
 */
export const TODO_BEARS: ReadonlySet<string> = new Set(['shodan', 'quote', 'doyaslide'])
export function bearSrc(tool: string): string | null {
  return TODO_BEARS.has(tool) ? `/shell/bear/todo/${tool}.webp` : BEAR_TOOL_IDS.has(tool) ? `/shell/bear/${tool}.webp` : null
}
export function TodoBear({ tool, size = 64, className }: { tool: string; size?: number; className?: string }) {
  const src = bearSrc(tool)
  if (!src) return <span className={`${styles.bearBlank} ${className ?? ''}`} style={{ width: size, height: size }} aria-hidden="true" />
  // 小さな固定の絵なので next/image の変換は通さない（幅と高さを決めて、読み込みでずれないようにする）
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} width={size} height={size} alt="" aria-hidden className={`${styles.bear} ${className ?? ''}`} decoding="async" draggable={false} />
}

const yen = (n: number) => `${Math.round(n).toLocaleString('ja-JP')}円`

/** できた物の中身。閉じているときは上の数行、開くと全部 */
export function DraftPreview({ detail, points, open }: { detail?: AgentDraftDetail; points: string[]; open: boolean }) {
  if (detail?.kind === 'quote') {
    const rows = open ? detail.rows : detail.rows.slice(0, 3)
    return (
      <div className={styles.preview}>
        <table className={styles.qtable}>
          <thead><tr><th scope="col">品目</th><th scope="col">数量</th><th scope="col">単価</th></tr></thead>
          <tbody>
            {rows.map((r, i) => <tr key={i}><td>{r.name}</td><td>{r.qty}{r.unit}</td><td>{yen(r.unitPrice)}</td></tr>)}
          </tbody>
        </table>
        {detail.count > rows.length ? <p className={styles.more}>ほか {detail.count - rows.length} 行</p> : null}
        <p className={styles.qsum}><span>合計（税抜）</span><b>{yen(detail.subtotal)}</b></p>
      </div>
    )
  }
  if (detail?.kind === 'slides') {
    const heads = open ? detail.heads : detail.heads.slice(0, 4)
    return (
      <div className={styles.preview}>
        <ol className={styles.slides}>
          {heads.map((h, i) => <li key={i}><span className={styles.slideNo}>{i + 1}</span><span>{h}</span></li>)}
        </ol>
        {detail.heads.length > heads.length ? <p className={styles.more}>ほか {detail.heads.length - heads.length} 枚</p> : null}
      </div>
    )
  }
  const lines = open ? points : points.slice(0, 3)
  if (!lines.length && detail?.kind !== 'company') return null
  return (
    <div className={styles.preview}>
      {detail?.kind === 'company' ? <p className={styles.company}>{detail.name}</p> : null}
      {lines.length ? <ul className={styles.points}>{lines.map((p, i) => <li key={i}>{p}</li>)}</ul> : null}
      {points.length > lines.length ? <p className={styles.more}>ほか {points.length - lines.length} 行</p> : null}
    </div>
  )
}

/** 1件のカード。done のときは中身を見せ、押すと広がる */
export function WorkCard({ item, index = 0, showTime = false, defaultOpen = false }: { item: WorkItem; index?: number; showTime?: boolean; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const bodyId = useId()
  const canOpen = item.status === 'done' && (item.points.length > 0 || Boolean(item.detail))
  return (
    <article className={styles.card} data-status={item.status} data-open={open ? 'true' : undefined} style={{ ['--i' as string]: index }}>
      <div className={styles.head}>
        <TodoBear tool={item.tool} size={56} />
        <div className={styles.headText}>
          <span className={styles.tags}>
            <span className={styles.tool}>{item.toolName}</span>
            <span className={styles.status} data-status={item.status}>
              {item.status === 'done' ? <CheckMark /> : null}{item.status === 'done' ? 'できた' : WORK_STATUS_LABEL[item.status]}
            </span>
            {showTime ? <time className={styles.time} dateTime={item.at}>{workTime(item.at)}</time> : null}
          </span>
          <b className={styles.title}>{item.title}</b>
          {item.summary ? <span className={styles.summary}>{item.summary}</span> : null}
        </div>
      </div>
      {item.status === 'done' ? (
        <div id={bodyId}>
          <DraftPreview detail={item.detail} points={item.points} open={open} />
        </div>
      ) : null}
      <div className={styles.foot}>
        {canOpen ? (
          <button type="button" className={styles.toggle} aria-expanded={open} aria-controls={bodyId} onClick={() => setOpen((v) => !v)}>
            {open ? '閉じる' : '全体を見る'}
          </button>
        ) : <span />}
        {item.href ? <Link href={item.href} className={styles.open}>{item.status === 'done' ? `${item.toolName}で開く` : item.hrefLabel ?? '開く'}<Arrow /></Link> : null}
      </div>
    </article>
  )
}

const CheckMark = () => (
  <svg className={styles.check} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5 10 17 19 7" /></svg>
)
const Arrow = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
)

/**
 * 経営ホームの「ドヤくんが進めた仕事」（直近3件）。すべては /home/work で見る。
 * 読み込みの間も高さを取っておき、あとから下の欄を押し下げない
 */
export function RecentWork({ executor }: { executor: 'api' | 'sample' }) {
  const [state, setState] = useState<{ items: WorkItem[]; loaded: boolean }>({ items: [], loaded: false })
  useEffect(() => {
    let live = true
    void readWorkItems(executor).then((r) => { if (live) setState({ items: r.items, loaded: true }) })
    return () => { live = false }
  }, [executor])
  const shown = state.items.slice(0, 3)
  return (
    <section className={styles.recent} aria-labelledby="recent-work-title">
      <div className={styles.recentHead}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/shell/bear/todo/history.webp" width={56} height={56} alt="" aria-hidden className={styles.bear} decoding="async" />
        <span className={styles.headText}>
          <span className={styles.eyebrow}>あとから見返す</span>
          <b id="recent-work-title" className={styles.recentTitle}>ドヤくんが進めた仕事</b>
        </span>
        {state.items.length ? <Link href="/home/work" className={styles.all}>すべて見る（{state.items.length}件）<Arrow /></Link> : null}
      </div>
      {!state.loaded ? (
        <div className={styles.recentSkeleton} aria-hidden="true"><i /><i /></div>
      ) : shown.length ? (
        <ul className={styles.rows}>
          {shown.map((it) => <WorkRow key={it.key} item={it} />)}
        </ul>
      ) : (
        <p className={styles.empty}>まだありません。上の欄からドヤくんに頼むと、できた物がここに並びます。</p>
      )}
    </section>
  )
}

/** 一覧の1行（小さく）。押すとツールの画面を開く */
export function WorkRow({ item }: { item: WorkItem }) {
  return (
    <li className={styles.row} data-status={item.status}>
      <TodoBear tool={item.tool} size={40} />
      <span className={styles.rowText}>
        <b>{item.title}</b>
        <span className={styles.rowMeta}>
          <time dateTime={item.at}>{workTime(item.at)}</time>
          <span className={styles.status} data-status={item.status}>{WORK_STATUS_LABEL[item.status]}</span>
        </span>
        {item.summary ? <span className={styles.rowSummary}>{item.summary}</span> : null}
      </span>
      {item.href ? <Link href={item.href} className={styles.rowOpen} aria-label={`${item.title}を開く`}>開く</Link> : null}
    </li>
  )
}
