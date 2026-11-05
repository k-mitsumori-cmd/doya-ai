'use client'
// ============================================
// ドヤAIに頼む — 右下の会話の欄（チャットで仕事を進める）
// ============================================
// 設計: docs/architecture/agent-chat/DESIGN-2026-11-05.md
// 流れ: 依頼 → 作業の一覧（画面を開く・値を入れる）→ 確認カード → 本人が「登録する」→ 完了。
// ⚠️ 完了の表示は、画面の送信が成功を知らせたあとだけ（turn.ts）。失敗したら、内容と次にできることを出す。
// ⚠️ 絵文字は使わない。動きは位置と透明度だけで、動きを減らす設定では止める（CSS）。
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { stashPrefill, withPrefillKey } from '@/lib/agent-router/prefill'
import type { NextAction } from '@/lib/agent-chat/types'
import { useAgentChat } from './AgentChatProvider'
import styles from './agent-dock.module.css'

function stepMark(status: 'wait' | 'run' | 'done') {
  if (status === 'done') return <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
  return <span className={styles.dot} aria-hidden="true" />
}

export default function AgentDock() {
  const chat = useAgentChat()
  const router = useRouter()
  const [draft, setDraft] = useState('')
  const [answer, setAnswer] = useState('')
  const bodyRef = useRef<HTMLDivElement>(null)
  const state = chat?.state
  // 新しい内容が出るたびに、会話の下端へ寄せる
  useEffect(() => {
    const el = bodyRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [state?.phase, state?.steps, state?.missing.length])
  useEffect(() => { setAnswer('') }, [state?.missing[0]?.key])
  if (!chat || !state) return null
  const { open, setOpen, dispatch } = chat

  const go = (n: NextAction) => {
    if (!n.prefill) { router.push(n.href); return }
    let storage: Storage | null = null
    try { storage = window.sessionStorage } catch { storage = null }
    router.push(withPrefillKey(n.href, stashPrefill(n.prefill, storage)))
  }
  const busy = state.phase === 'reading' || state.phase === 'working' || state.phase === 'submitting'
  const canType = !busy && state.phase !== 'asking' && state.phase !== 'confirm'
  const sendDraft = () => {
    const t = draft.trim()
    if (!t) return
    setDraft('')
    dispatch({ t: 'ask', text: t })
  }
  const field = state.missing[0]
  const waiting = state.phase === 'confirm'

  return (
    <>
      <button type="button" className={styles.fab} data-open={open ? 'true' : 'false'} onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="agent-dock-panel">
        <span className={styles.fabLabel}>ドヤAIに頼む</span>
        {waiting && !open ? <span className={styles.badge}>確認待ち</span> : null}
      </button>
      <section id="agent-dock-panel" className={styles.panel} data-open={open ? 'true' : 'false'} aria-label="ドヤAIに頼む" aria-hidden={!open}>
        <header className={styles.head}>
          <strong>ドヤAIに頼む</strong>
          <button type="button" className={styles.close} onClick={() => setOpen(false)} aria-label="閉じる">閉じる</button>
        </header>
        <div className={styles.body} ref={bodyRef} aria-live="polite">
          {state.phase === 'idle' && (
            <p className={styles.hint}>やりたいことを書いてください。例: 今月の売上100万円追加して</p>
          )}
          {state.text ? <p className={styles.user}>{state.text}</p> : null}
          {state.phase === 'reading' && <p className={styles.say}>依頼を読んでいます…</p>}
          {state.say && state.phase !== 'reading' ? <p className={styles.say}>{state.say}</p> : null}

          {state.steps.length > 0 && state.phase !== 'guided' && (
            <ol className={styles.steps}>
              {state.steps.map((s) => (
                <li key={s.id} data-status={s.status}>{stepMark(s.status)}<span>{s.label}</span></li>
              ))}
            </ol>
          )}

          {state.phase === 'asking' && field && (
            <form className={styles.ask} onSubmit={(e) => { e.preventDefault(); dispatch({ t: 'answer', value: answer }) }}>
              <label className={styles.say} htmlFor="agent-dock-answer">{field.ask ?? `${field.label}を教えてください。`}</label>
              <div className={styles.row}>
                <input id="agent-dock-answer" className={styles.input} value={answer} onChange={(e) => setAnswer(e.target.value)} inputMode={field.type === 'yen' || field.type === 'number' ? 'numeric' : undefined} autoFocus />
                <button type="submit" className={styles.primary} disabled={!answer.trim()}>送る</button>
              </div>
              {state.askError ? <p className={styles.err} role="alert">{state.askError}</p> : null}
            </form>
          )}

          {state.confirm && (state.phase === 'confirm' || state.phase === 'submitting' || (state.phase === 'failed')) && (
            <div className={styles.card}>
              <p className={styles.cardTitle}>{state.confirm.title}</p>
              <dl className={styles.rows}>
                {state.confirm.rows.map((r) => (
                  <div key={r.label} data-big={r.big ? 'true' : 'false'}><dt>{r.label}</dt><dd>{r.value}</dd></div>
                ))}
              </dl>
              {state.confirm.note ? <p className={styles.note}>{state.confirm.note}</p> : null}
              {state.phase !== 'failed' && (
                <div className={styles.actions}>
                  <button type="button" className={styles.primary} disabled={state.phase !== 'confirm'} onClick={() => dispatch({ t: 'approve' })}>
                    {state.phase === 'submitting' ? '登録しています…' : state.confirm.submitLabel}
                  </button>
                  <button type="button" className={styles.ghost} disabled={state.phase !== 'confirm'} onClick={() => setOpen(false)}>画面で直す</button>
                  <button type="button" className={styles.ghost} disabled={state.phase !== 'confirm'} onClick={() => dispatch({ t: 'reset' })}>やめる</button>
                </div>
              )}
            </div>
          )}

          {state.phase === 'failed' && (
            <div className={styles.fail} role="alert">
              <p>{state.error}</p>
              <div className={styles.actions}>
                <button type="button" className={styles.primary} onClick={() => dispatch({ t: 'retry' })}>{state.confirm ? '確認カードに戻る' : 'もう一度やる'}</button>
                <button type="button" className={styles.ghost} onClick={() => dispatch({ t: 'reset' })}>やめる</button>
              </div>
            </div>
          )}

          {state.phase === 'done' && state.done && (
            <div className={styles.done}>
              <p className={styles.say}>{state.done.lead}</p>
              {state.done.made ? <p className={styles.note}>作ったもの: {state.done.made}</p> : null}
              <div className={styles.next}>
                {state.done.next.map((n) => (
                  <button key={n.id} type="button" className={styles.nextBtn} onClick={() => go(n)}><span>{n.label}</span><small>{n.hint}</small></button>
                ))}
              </div>
            </div>
          )}

          {state.phase === 'guided' && state.guide && (
            <div className={styles.done}>
              {state.guide.kind === 'action' && (
                <>
                  <p className={styles.say}>{state.guide.reason || `「${state.guide.action.label}」の画面で進められます。`}</p>
                  <div className={styles.actions}>
                    <button type="button" className={styles.primary} onClick={() => { const g = state.guide; if (g?.kind === 'action') go({ id: g.action.id, label: g.action.label, hint: '', href: g.href, prefill: g.values }) }}>画面を開く</button>
                  </div>
                </>
              )}
              {state.guide.kind === 'plan' && (
                <>
                  <p className={styles.say}>{state.guide.reason || '複数の手順が要る依頼です。経営ホームで進められます。'}</p>
                  <div className={styles.actions}><button type="button" className={styles.primary} onClick={() => router.push('/home')}>経営ホームを開く</button></div>
                </>
              )}
              {state.guide.kind === 'unknown' && (
                <>
                  <p className={styles.say}>{state.guide.reason || 'この依頼に合う操作を、見つけられませんでした。'}</p>
                  <div className={styles.next}>
                    {state.guide.suggestions.map((s) => (
                      <button key={s.href} type="button" className={styles.nextBtn} onClick={() => router.push(s.href)}><span>{s.label}</span></button>
                    ))}
                  </div>
                </>
              )}
              {state.guide.kind === 'limited' && <p className={styles.say}>{state.guide.reason}</p>}
            </div>
          )}
        </div>
        <form className={styles.foot} onSubmit={(e) => { e.preventDefault(); sendDraft() }}>
          <input className={styles.input} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="やりたいことを書く" disabled={!canType} maxLength={500} aria-label="ドヤAIへの依頼" />
          <button type="submit" className={styles.primary} disabled={!canType || !draft.trim()}>送る</button>
        </form>
      </section>
    </>
  )
}
