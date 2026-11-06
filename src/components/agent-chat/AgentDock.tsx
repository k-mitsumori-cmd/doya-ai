'use client'
// ============================================
// ドヤAIに頼む — 右下の会話の欄（チャットで仕事を進める）
// ============================================
// 設計: docs/architecture/agent-chat/DESIGN-2026-11-05.md
// 流れ: 依頼 → 作業の一覧（画面を開く・値を入れる）→ 確認カード → 本人が「登録する」→ 完了。
// ⚠️ 完了の表示は、画面の送信が成功を知らせたあとだけ（turn.ts）。失敗したら、内容と次にできることを出す。
// ⚠️ 絵文字は使わない。動きは位置と透明度だけで、動きを減らす設定では止める（CSS）。
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useRouter } from 'next/navigation'
import { stashPrefill, withPrefillKey } from '@/lib/agent-router/prefill'
import type { NextAction } from '@/lib/agent-chat/types'
import { useAgentChat } from './AgentChatProvider'
import { celebrate } from './motion'
import styles from './agent-dock.module.css'

/** スマホの幅か（767px 以下。AppShell と同じ境目）。最初の描画は false（サーバーと同じ）にして、あとで合わせる */
function useMobile(): boolean {
  const [m, setM] = useState(false)
  useEffect(() => {
    const q = window.matchMedia('(max-width: 767px)')
    const f = () => setM(q.matches)
    f()
    q.addEventListener('change', f)
    return () => q.removeEventListener('change', f)
  }, [])
  return m
}

function stepMark() {
  return <i className={styles.dot} aria-hidden="true" />
}

export default function AgentDock() {
  const chat = useAgentChat()
  const router = useRouter()
  const [draft, setDraft] = useState('')
  const [answer, setAnswer] = useState('')
  const mobile = useMobile()
  // スマホで、作業の一覧が長いと確認カードが見えなくなる。確認・完了・失敗のときは一覧を畳んで、1行の見出しにする（押すと開く）
  const [stepsOpen, setStepsOpen] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)
  const state = chat?.state
  // 新しい内容が出るたびに、会話の下端へ寄せる
  useEffect(() => {
    const el = bodyRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [state?.phase, state?.steps, state?.missing.length])
  useEffect(() => { setAnswer('') }, [state?.missing[0]?.key])
  useEffect(() => { if (state?.phase === 'reading') setStepsOpen(false) }, [state?.phase])
  const doneRef = useRef<HTMLDivElement>(null)
  const phase = state?.phase
  const open = chat?.open ?? false
  const view = chat?.view ?? 'both'
  // 完了のお祝いは、画面の送信が成功を知らせたあと（phase が done になったとき）だけ
  useEffect(() => { if (phase === 'done') celebrate(doneRef.current) }, [phase])
  // 枠の本文の幅（デスクトップ）と下の余白（スマホ）を、会話の欄に合わせる。本文は隠さず、狭めて並べる（AppShell.module.css）
  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--agent-dock-w', open ? '400px' : '0px')
    // 会話の欄そのものの高さ（--agent-dock-ph）は、開いているかどうかに依らず見せ方（view）だけで決める。開く瞬間に 0 から伸びて、レイアウトのずれになるのを避けるため。
    // 本文の下の余白（--agent-dock-h）は、開いているときだけ欄の高さと同じにする
    const ph = view === 'tool' ? '56px' : view === 'chat' ? 'calc(100dvh - 60px - var(--agent-tab-h, 68px))' : '46dvh'
    root.style.setProperty('--agent-dock-ph', ph)
    root.style.setProperty('--agent-dock-h', open ? ph : '0px')
    return () => { root.style.removeProperty('--agent-dock-w'); root.style.removeProperty('--agent-dock-h'); root.style.removeProperty('--agent-dock-ph') }
  }, [open, view])
  if (!chat || !state) return null
  const { setOpen, setView, dispatch } = chat

  const go = (n: NextAction) => {
    if (!n.prefill) { router.push(n.href); return }
    let storage: Storage | null = null
    try { storage = window.sessionStorage } catch { storage = null }
    router.push(withPrefillKey(n.href, stashPrefill(n.prefill, storage)))
  }
  const busy = state.phase === 'reading' || state.phase === 'working' || state.phase === 'submitting'
  const canType = !busy && state.phase !== 'asking'
  const sendDraft = () => {
    const t = draft.trim()
    if (!t) return
    setDraft('')
    // 確認カードが出ているときは、金額などの直し。それ以外は新しい依頼
    dispatch(state.phase === 'confirm' ? { t: 'adjust', text: t } : { t: 'ask', text: t })
  }
  const field = state.missing[0]
  // 答えを待っている（聞き返し・確認カード）。スマホで「会話」を見ていないときに、印を出す
  const waiting = state.phase === 'asking' || state.phase === 'confirm'
  const doneCount = state.steps.filter((x) => x.status === 'done').length
  const total = state.steps.length
  const lastAnswer = state.answers.length - 1
  const foldable = mobile && (state.phase === 'confirm' || state.phase === 'submitting' || state.phase === 'failed' || state.phase === 'done')
  // スマホでは、確認カードのボタンを会話の下に固定する（カードが長くても押せる）
  const pinned = mobile && Boolean(state.confirm) && (state.phase === 'confirm' || state.phase === 'submitting')

  const confirmActions = state.confirm ? (
    <div className={pinned ? styles.pin : styles.actions}>
      <button type="button" className={styles.primary} disabled={state.phase !== 'confirm'} onClick={() => dispatch({ t: 'approve' })}>
        {state.phase === 'submitting' ? '登録しています…' : state.confirm.submitLabel}
      </button>
      <button type="button" className={styles.ghost} disabled={state.phase !== 'confirm'} onClick={() => dispatch({ t: 'adjust', text: '税込みだった' })}>税込みだった</button>
      <button type="button" className={styles.ghost} disabled={state.phase !== 'confirm'} onClick={() => dispatch({ t: 'reset' })}>やめる</button>
    </div>
  ) : null

  return (
    <>
      <button type="button" className={styles.fab} data-open={open ? 'true' : 'false'} onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="agent-dock-panel">
        <span className={styles.fabLabel}>ドヤAIに頼む</span>
        {waiting && !open ? <span className={styles.badge}>返事待ち</span> : null}
      </button>
      <section id="agent-dock-panel" className={styles.panel} data-open={open ? 'true' : 'false'} data-view={view} aria-label="ドヤAIに頼む" aria-hidden={!open}>
        <header className={styles.head}>
          <strong>ドヤAI</strong>
          {/* スマホだけ出す切り替え（会話・両方・画面）。見出しと同じ行に置き、狭い画面の高さを使いすぎない */}
          <div className={styles.viewsw} role="group" aria-label="表示の切り替え">
            {([['chat', '会話'], ['both', '両方'], ['tool', '画面']] as const).map(([v, label]) => (
              <button key={v} type="button" data-on={view === v ? 'true' : 'false'} aria-pressed={view === v} onClick={() => setView(v)}>
                {label}{v === 'chat' && waiting && view !== 'chat' ? <span className={styles.waitMark} aria-label="返事待ち" /> : null}
              </button>
            ))}
          </div>
          {total > 0 ? <em className={styles.count} aria-label={`作業 ${doneCount} 件 / ${total} 件`}>{doneCount} / {total}</em> : <span className={styles.grow} />}
          <button type="button" className={styles.close} onClick={() => setOpen(false)} aria-label="会話の欄を閉じる">閉じる</button>
        </header>
        <div className={styles.prog} aria-hidden="true"><i style={{ transform: `scaleX(${total ? doneCount / total : 0})` }} /></div>
        <div className={styles.body} ref={bodyRef} data-agent-body="" aria-live="polite">
          {state.phase === 'idle' && (
            <p className={styles.hint}>やりたいことを書いてください。例: 今月の売上100万円追加して</p>
          )}
          {state.text ? <p className={styles.user} data-agent-source={state.answers.length === 0 ? '' : undefined}>{state.text}</p> : null}
          {state.answers.map((a, i) => <p key={i} className={styles.user} data-agent-source={i === lastAnswer ? '' : undefined}>{a}</p>)}
          {state.phase === 'reading' && <p className={styles.say}>依頼を読んでいます…</p>}
          {state.say && state.phase !== 'reading' ? <p className={styles.lead}>{state.say}</p> : null}

          {foldable && state.steps.length > 0 && (
            <button type="button" className={styles.stepsToggle} aria-expanded={stepsOpen} onClick={() => setStepsOpen(!stepsOpen)}>
              <span>作業 {doneCount} / {total} 件</span><small>{stepsOpen ? '畳む' : '見る'}</small>
            </button>
          )}
          {state.steps.length > 0 && state.phase !== 'guided' && !(foldable && !stepsOpen) && (
            <ol className={styles.steps}>
              {state.steps.map((s, i) => (
                <li key={s.id} data-status={s.status} style={{ '--i': i } as CSSProperties}>{stepMark()}<span>{s.label}</span></li>
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
              {state.notice ? <p className={styles.say}>{state.notice}</p> : null}
              <p className={styles.cardTitle}>{state.confirm.title}</p>
              <dl className={styles.rows}>
                {state.confirm.rows.map((r) => (
                  <div key={r.label} data-big={r.big ? 'true' : 'false'}><dt>{r.label}</dt><dd>{r.value}</dd></div>
                ))}
              </dl>
              {state.confirm.note ? <p className={styles.note}>{state.confirm.note}</p> : null}
              {state.phase !== 'failed' && !pinned && confirmActions}
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
              <p className={styles.lead}>{state.done.lead}</p>
              {state.done.made ? <div className={styles.donecard} ref={doneRef}>できた物: {state.done.made}</div> : null}
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
        {pinned && confirmActions}
        <form className={styles.foot} onSubmit={(e) => { e.preventDefault(); sendDraft() }}>
          <input className={styles.input} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={state.phase === 'confirm' ? '直したいことがあれば入力' : 'やりたいことを書く'} disabled={!canType} maxLength={500} aria-label={state.phase === 'confirm' ? '金額などの直し' : 'ドヤAIへの依頼'} />
          <button type="submit" className={styles.primary} disabled={!canType || !draft.trim()}>送る</button>
        </form>
      </section>
    </>
  )
}
