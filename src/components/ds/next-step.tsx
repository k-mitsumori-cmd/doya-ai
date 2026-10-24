'use client'
// ============================================
// ds/next-step — 次にやること帯（T1）と手順の札（T2）
// ============================================
// 見本はドヤ展示会のブース設計（src/components/tenjikai/BoothStudio.tsx。docs/audits/2026-10-24-ux-clarity/TENJIKAI-PATTERNS.md）。
// - 帯: 今の状態を表す一文と、主ボタン1つ。状態（まだ・作成中・できた・エラー）で文とボタンを入れ替える
// - 札: 3〜5段の手順。済み・今・まだを色と印で分け、今の段に aria-current="step" を付ける
// ⚠️ ここで API を呼ばない。状態は props で受け取る。各ツールの文は next-step-copy.ts に置く
// ⚠️ 帯の外の主ボタン（塗りつぶし）は増やさない。帯のボタンが1つだけの主ボタンになるようにする
import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { ShellIcon, type ShellIconName } from '@/components/shell/icons'
import { flowStepState, type NextStepState } from './next-step-model'
import { nextStepCopy, type NextStepTool } from './next-step-copy'
import styles from './next-step.module.css'

export type { NextStepState } from './next-step-model'

/* ---- NextStepBar（T1） ---- */
export function NextStepBar({ text, sub, action, state = 'empty', label = '次にやること', className }: {
  /** 今の状態を表す一文（30〜45字。next-step-copy.ts の文を使う）。null は読み込み中（高さだけ取っておく） */
  text: string | null
  /** 補いの一文（残りの回数など）。無くてもよい */
  sub?: ReactNode
  /** 主ボタン（<NextStepAction> を1つ）。ボタンが要らない状態では渡さない */
  action?: ReactNode
  state?: NextStepState
  /** 読み上げの見出し */
  label?: string
  className?: string
}) {
  return (
    <section className={`${styles.bar} ${className ?? ''}`} aria-label={label} data-state={state} aria-busy={state === 'working' || text === null || undefined}>
      <div className={styles.text}>
        {/* 領域は残し、中の文だけを入れ替える（状態が変わると読み上げられる） */}
        <div className={styles.live} aria-live="polite" aria-atomic="true">
          {text === null
            ? <span className={styles.placeholder} aria-hidden />
            : <p key={text} className={styles.sentence}>{text}</p>}
        </div>
        {sub ? <p className={styles.sub}>{sub}</p> : null}
      </div>
      {action ? <div className={styles.action}>{action}</div> : null}
    </section>
  )
}

/* ---- NextStepAction（帯の主ボタン） ---- */
type ActionBase = {
  children: ReactNode
  /** ボタンの印（lucide の名前）。busy のときは回る印に替わる */
  icon?: ShellIconName
  /** 印を直接渡すとき（展示会の ImagePlus など）。icon より優先する */
  iconNode?: ReactNode
  /** 作っている間。押せなくし、回る印を出す（動きを減らす設定では回さない） */
  busy?: boolean
  /** 読み上げのラベル（見た目の文と違う説明が要るとき） */
  ariaLabel?: string
}
export function NextStepAction(props: ActionBase & (
  | { href: string; onClick?: never; disabled?: never }
  | { href?: undefined; onClick?: () => void; disabled?: boolean }
)) {
  const { children, icon, iconNode, busy, ariaLabel } = props
  const mark = busy
    ? <Loader2 className={styles.spin} size={16} aria-hidden />
    : iconNode ?? (icon ? <ShellIcon name={icon} size={16} /> : null)
  const inner = <>{mark}{children}</>
  if (props.href !== undefined) {
    return <Link href={props.href} className={styles.primary} aria-label={ariaLabel}>{inner}</Link>
  }
  return (
    <button type="button" onClick={props.onClick} disabled={props.disabled || busy} aria-busy={busy || undefined} aria-label={ariaLabel} className={styles.primary}>
      {inner}
    </button>
  )
}

/* ---- FlowSteps（T2） ---- */
export function FlowSteps({ steps, current, label, className }: {
  /** 3〜5段の手順の名前 */
  steps: readonly string[]
  /** 今の段の番号（0 から）。steps.length ならすべて済み */
  current: number
  /** 読み上げの見出し（例: 「ブース設計の進め方」） */
  label: string
  className?: string
}) {
  const n = steps.length
  const style = { '--cols': n, '--cols-sm': n >= 4 ? 2 : n } as CSSProperties
  return (
    <ol className={`${styles.steps} ${className ?? ''}`} aria-label={label} style={style}>
      {steps.map((s, i) => {
        const st = flowStepState(i, current)
        return (
          <li key={s} className={styles.step} data-state={st} aria-current={st === 'now' ? 'step' : undefined}>
            <span className={styles.mark} aria-hidden>{st === 'done' ? <Check size={14} /> : i + 1}</span>
            <span className={styles.label}>
              {st === 'done' ? <span className={styles.srOnly}>済み：</span> : null}
              {s}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

/* ---- ToolNextStep（ツールの帯。文とボタンの文は next-step-copy.ts から引く） ---- */
/** 帯に出す状態。null は読み込み中（高さだけ取る） */
export type NextStepView = {
  /** next-step-copy.ts のキー（4つの状態か、ツールが足した途中の状態） */
  key: string
  state: NextStepState
  /** 文に入る数（件数・割合など） */
  n?: number
  href?: string
  onClick?: () => void
  disabled?: boolean
  busy?: boolean
  /** ボタンの文を差し替えるとき（上限で「問い合わせる」にするなど） */
  actionLabel?: string
  icon?: ShellIconName
} | null

export function ToolNextStep({ tool, view, sub, className }: { tool: NextStepTool; view: NextStepView; sub?: ReactNode; className?: string }) {
  if (!view) return <NextStepBar text={null} className={className} />
  const copy = nextStepCopy(tool, view.key as never, view.n ?? 0)
  const label = view.actionLabel ?? copy.action
  let action: ReactNode = null
  if (label && view.href) action = <NextStepAction href={view.href} icon={view.icon}>{label}</NextStepAction>
  else if (label && view.onClick) action = <NextStepAction onClick={view.onClick} disabled={view.disabled} busy={view.busy} icon={view.icon}>{label}</NextStepAction>
  return <NextStepBar state={view.state} text={copy.text} sub={sub} action={action} className={className} />
}
