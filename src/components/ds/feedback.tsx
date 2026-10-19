'use client'
// ============================================
// ds/feedback — 使い方・生成中・完了・エラーの表示（UI 品質 S-16・S-18・S-19・S-20）
// ============================================
// 全ツールで同じ形にするための部品。各ツールは、文言と次の行き先だけを渡す。
// ⚠️ ここで API を呼ばない。状態は props で受け取る。
// ⚠️ エラーの中身（例外の文・内部のコード）をそのまま message に入れない。利用者向けの文にする。
import { useEffect, useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, X } from 'lucide-react'
import { usePrefersReducedMotion } from './motion'
import styles from './feedback.module.css'

/* ---- FirstSteps（初めて開いたときの3ステップ。閉じたら出さない。S-16） ---- */
export function FirstSteps({ id, title = 'はじめての使い方', steps, action }: {
  /** 閉じたことを覚えるための名前（ツールの id など）。ブラウザに覚える */
  id: string
  title?: string
  /** 3つまで。1つ目から順に、やることを短く書く */
  steps: { title: string; body?: string }[]
  action?: ReactNode
}) {
  const key = `doya_first_steps:${id}`
  const [shown, setShown] = useState(false)
  useEffect(() => {
    try { setShown(window.localStorage.getItem(key) !== '1') } catch { setShown(true) }
  }, [key])
  if (!shown) return null
  const close = () => {
    setShown(false)
    try { window.localStorage.setItem(key, '1') } catch { /* 覚えられなくても閉じる */ }
  }
  return (
    <section className={styles.steps} aria-label={title}>
      <div className={styles.stepsHead}>
        <p className={styles.stepsTitle}>{title}</p>
        <button type="button" className={styles.close} onClick={close} aria-label="使い方を閉じる"><X size={16} aria-hidden /></button>
      </div>
      <ol className={styles.stepList}>
        {steps.slice(0, 3).map((s, i) => (
          <li key={s.title}>
            <span className={styles.stepNum}>{i + 1}</span>
            <div><p className={styles.stepTitle}>{s.title}</p>{s.body ? <p className={styles.stepBody}>{s.body}</p> : null}</div>
          </li>
        ))}
      </ol>
      {action ? <div className={styles.stepsAction}>{action}</div> : null}
    </section>
  )
}

/* ---- GenerationProgress（AI の生成中。今の段階と残り時間の目安。S-18） ---- */
export function GenerationProgress({ stages, current, startedAt, estimateSec, onCancel }: {
  /** 段階の名前（例: ['読み取り中', '作成中', '仕上げ中']） */
  stages: string[]
  /** 今の段階の番号（0 から） */
  current: number
  /** 始めた時刻（Date.now() の値） */
  startedAt: number
  /** 全体のかかる時間の目安（秒） */
  estimateSec: number
  onCancel?: () => void
}) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const reduced = usePrefersReducedMotion()
  const elapsed = Math.max(0, (now - startedAt) / 1000)
  const left = Math.max(0, Math.round(estimateSec - elapsed))
  const ratio = Math.min(0.95, Math.max((current + 0.5) / Math.max(stages.length, 1), elapsed / Math.max(estimateSec, 1)))
  const leftText = left > 60 ? `あと${Math.ceil(left / 60)}分ほど` : left > 0 ? `あと${left}秒ほど` : 'もうすぐ終わります'
  return (
    <div className={styles.progress} role="status" aria-live="polite">
      <div className={styles.progressHead}>
        <p className={styles.progressStage}>{stages[current] ?? stages[stages.length - 1]}</p>
        <p className={styles.progressLeft}>{leftText}</p>
      </div>
      <div className={styles.bar} aria-hidden><span style={{ width: `${Math.round(ratio * 100)}%`, transition: reduced ? 'none' : undefined }} /></div>
      <ol className={styles.stageList}>
        {stages.map((s, i) => (
          <li key={s} data-state={i < current ? 'done' : i === current ? 'now' : 'next'}>{s}</li>
        ))}
      </ol>
      {onCancel ? <button type="button" className={styles.linkButton} onClick={onCancel}>止める</button> : null}
    </div>
  )
}

/* ---- DoneBanner（生成が終わったとき。短い成功の表示と、次にやること。S-19） ---- */
export function DoneBanner({ title, next, onClose }: {
  title: string
  /** 次にやることのボタン（1つ） */
  next?: ReactNode
  onClose?: () => void
}) {
  return (
    <div className={styles.done} role="status">
      <CheckCircle2 size={18} aria-hidden className={styles.doneIcon} />
      <p className={styles.doneTitle}>{title}</p>
      {next ? <div className={styles.doneNext}>{next}</div> : null}
      {onClose ? <button type="button" className={styles.close} onClick={onClose} aria-label="閉じる"><X size={16} aria-hidden /></button> : null}
    </div>
  )
}

/* ---- ErrorNotice（何が起きたか・どうすればよいか・やり直す。S-20） ---- */
export function ErrorNotice({ what, how, onRetry, retryLabel = 'やり直す' }: {
  /** 何が起きたか（利用者向けの文） */
  what: string
  /** どうすればよいか */
  how?: string
  onRetry?: () => void
  retryLabel?: string
}) {
  return (
    <div className={styles.error} role="alert">
      <AlertTriangle size={18} aria-hidden className={styles.errorIcon} />
      <div className={styles.errorText}>
        <p className={styles.errorWhat}>{what}</p>
        {how ? <p className={styles.errorHow}>{how}</p> : null}
      </div>
      {onRetry ? <button type="button" className={styles.retry} onClick={onRetry}>{retryLabel}</button> : null}
    </div>
  )
}
