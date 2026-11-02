'use client'
// ============================================
// /home/work 「ドヤくんが進めた仕事」の一覧（新しい順。期間とツールで絞り込む）
// ============================================
// 2026-11-01 本人の指示「進めたタスクを全部見れるようにしてください。もっと使いやすく」。
// データは保存済みの作戦から作る（history.ts）。カードを押すと中身が広がり、「〇〇で開く」で各ツールの画面へ移る。
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { readWorkItems, type WorkItem } from './history'
import { TodoBear, WorkCard } from './WorkCards'
import styles from './work.module.css'

type Range = 'all' | 'today' | '7' | '30'
const RANGES: { id: Range; label: string }[] = [
  { id: 'all', label: 'すべて' }, { id: 'today', label: '今日' }, { id: '7', label: '7日' }, { id: '30', label: '30日' },
]

/** 日本時間の今日の0時（ミリ秒） */
function jstTodayStart(now: number): number {
  const j = new Date(now + 9 * 3600_000)
  return Date.UTC(j.getUTCFullYear(), j.getUTCMonth(), j.getUTCDate()) - 9 * 3600_000
}

export default function WorkHistory({ executor = 'api' }: { executor?: 'api' | 'sample' }) {
  const [state, setState] = useState<{ items: WorkItem[]; loaded: boolean; failed: boolean; from: 'server' | 'device' }>({ items: [], loaded: false, failed: false, from: 'server' })
  const [range, setRange] = useState<Range>('all')
  const [tool, setTool] = useState<string>('all')
  useEffect(() => {
    let live = true
    void readWorkItems(executor).then((r) => { if (live) setState({ ...r, loaded: true }) })
    return () => { live = false }
  }, [executor])

  const tools = useMemo(() => {
    const m = new Map<string, string>()
    for (const it of state.items) m.set(it.tool, it.toolName)
    return [...m.entries()]
  }, [state.items])
  const shown = useMemo(() => {
    const now = Date.now()
    const since = range === 'all' ? 0 : range === 'today' ? jstTodayStart(now) : now - Number(range) * 86400_000
    return state.items.filter((it) => (tool === 'all' || it.tool === tool) && (since === 0 || Date.parse(it.at) >= since))
  }, [state.items, range, tool])
  const doneCount = state.items.filter((it) => it.status === 'done').length

  return (
    <div className={styles.page}>
      <header className={styles.pageHead}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/shell/bear/todo/history.webp" width={96} height={96} alt="" aria-hidden className={styles.pageBear} decoding="async" />
        <span className={styles.headText}>
          <span className={styles.eyebrow}>経営ホーム</span>
          <h1 className={styles.pageTitle}>ドヤくんが進めた仕事</h1>
          <span className={styles.summary}>
            {state.loaded ? `できた下書き ${doneCount} 件。新しい順に並べています。` : '読み込んでいます'}
          </span>
        </span>
        <Link href="/home" className={styles.all}>経営ホームへ戻る</Link>
      </header>

      <div className={styles.filters} role="group" aria-label="絞り込み">
        <div className={styles.filterRow}>
          <span className={styles.filterLabel}>期間</span>
          {RANGES.map((r) => (
            <button key={r.id} type="button" className={styles.filterChip} aria-pressed={range === r.id} onClick={() => setRange(r.id)}>{r.label}</button>
          ))}
        </div>
        {tools.length > 1 ? (
          <div className={styles.filterRow}>
            <span className={styles.filterLabel}>ツール</span>
            <button type="button" className={styles.filterChip} aria-pressed={tool === 'all'} onClick={() => setTool('all')}>すべて</button>
            {tools.map(([id, name]) => (
              <button key={id} type="button" className={`${styles.filterChip} ${styles.filterTool}`} aria-pressed={tool === id} onClick={() => setTool(id)}>
                <TodoBear tool={id} size={24} />{name}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {state.failed ? <p className={styles.notice} role="status">サーバーの記録を読めなかったため、この端末に残っている分だけを出しています。</p> : null}
      {state.loaded && state.from === 'device' && !state.failed ? <p className={styles.notice} role="status">この端末で進めた仕事を出しています。ほかの端末で進めた分は出ません。</p> : null}

      {!state.loaded ? (
        <div className={styles.recentSkeleton} aria-hidden="true"><i /><i /><i /></div>
      ) : shown.length ? (
        <div className={styles.grid}>
          {shown.map((it, i) => <WorkCard key={it.key} item={it} index={Math.min(i, 6)} showTime />)}
        </div>
      ) : (
        <div className={styles.emptyBig}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/character/empty-256.webp" width={140} height={140} alt="" aria-hidden decoding="async" />
          <p>{state.items.length ? 'この条件に合う仕事はありません。期間かツールを変えてください。' : 'まだありません。経営ホームの欄からドヤくんに頼むと、できた物がここに並びます。'}</p>
          {state.items.length ? null : <Link href="/home" className={styles.open}>経営ホームで頼む</Link>}
        </div>
      )}
      <p className={styles.footNote}>できた物はすべて下書きです。送る・公開する操作は、各ツールで内容を確かめてから行ってください。</p>
    </div>
  )
}
