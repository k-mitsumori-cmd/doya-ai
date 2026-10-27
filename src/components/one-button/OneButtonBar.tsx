'use client'
// ============================================
// 「これ1つで全部進む」帯（各ツールの画面のいちばん上）
// ============================================
// ドヤくん ＋ 一言の呼びかけ（「ここまで入れたら押してね」など）＋ 横に長い大きなボタン1つ ＋ 押すとどこまで進むかの小さな説明。
// 動いている間は、進み具合のバーと「n/N」を出す。ほかの操作は、この帯の下に小さく置く（各ツールの画面の側で）。
// 2026-10-27 ユーザーの指示（統括経由）。旗 ONE_BUTTON_ROLLOUT の内側だけで使う（useOneButton）。
// ⚠️ 絵文字は使わない。ドヤくんの絵は public/character/<pose>-256.webp
import type { ReactNode } from 'react'
import styles from './one-button.module.css'

export type OneButtonPose = 'point' | 'working' | 'success' | 'thinking' | 'hello' | 'error'

export function OneButtonBar({ eyebrow, cta, label, scope, onRun, href, disabled = false, disabledReason, running = false, clickableWhileRunning = false, progress, pose, extra }: {
  /** 画面の名前（例「ブース設計」）。小さく上に出す */
  eyebrow?: string
  /** ドヤくんの一言（例「ブースの形が決まったら、押してね」） */
  cta: string
  /** ボタンの文字（例「面の画像をまとめて作る（9面）」） */
  label: ReactNode
  /** 押すとどこまで進むか（例「まだ画像の無い9面を1面ずつ作り、できた面から3Dに貼ります」） */
  scope: string
  onRun?: () => void
  /** 押したら別の画面へ移るとき */
  href?: string
  disabled?: boolean
  /** 押せない理由（disabled のときだけ出す） */
  disabledReason?: string
  running?: boolean
  /** 動いている間も押せるようにする（押すと進み具合を開く、などのときだけ。既定は押せない＝二重に動かさない） */
  clickableWhileRunning?: boolean
  /** 動いている間の進み具合 */
  progress?: { done: number; total: number }
  /** ドヤくんのポーズ。既定は、動いている間は working、それ以外は point */
  pose?: OneButtonPose
  /** ボタンの横に添える小さなもの（ドヤパワーの減る量の札など） */
  extra?: ReactNode
}) {
  const face = pose ?? (running ? 'working' : disabled ? 'thinking' : 'point')
  const pct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0
  const buttonInner = (
    <>
      <span className={styles.label}>{label}</span>
      {extra ? <span className={styles.extra}>{extra}</span> : null}
    </>
  )
  return (
    <section className={styles.bar} data-state={running ? 'running' : disabled ? 'disabled' : 'ready'} aria-label="この画面の操作">
      <img src={`/character/${face}-256.webp`} alt="" width={96} height={96} className={styles.kun} />
      <div className={styles.main}>
        {eyebrow ? <p className={styles.eyebrow}>{eyebrow}</p> : null}
        <p className={styles.cta}>{cta}</p>
        {href && !disabled && !running ? (
          <a href={href} className={styles.button}>{buttonInner}</a>
        ) : (
          <button type="button" className={styles.button} onClick={onRun} disabled={disabled || (running && !clickableWhileRunning)} aria-busy={running || undefined}>
            {buttonInner}
          </button>
        )}
        {running && progress ? (
          <div className={styles.progress} role="progressbar" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.done} aria-label="進み具合">
            <span className={styles.track}><span className={styles.fill} style={{ width: `${pct}%` }} /></span>
            <span className={styles.count}>{progress.done}/{progress.total}</span>
          </div>
        ) : null}
        <p className={styles.scope}>{disabled && disabledReason ? disabledReason : scope}</p>
      </div>
    </section>
  )
}
