'use client'
// ============================================
// 作っている間の待ち画面（ドヤくんが壁の面をローラーで塗る）
// ============================================
// 2026-10-29 ユーザー「画像を作っている時の待ち時間も、クマちゃんが作っているような絵にして、遊び心を加えてほしい」。
// - 画像・書類などを作っている間に出す、共通の部品。ツールは問わない（colors を渡すと、その色で塗る）
// - progress（0〜1）を渡すと、塗る高さを進み具合にそろえる。渡さないときは、塗って戻す動きを繰り返す
// - steps は「いま何をしている途中か」の目安の一言。順に入れ替えて出す（進み具合の数字は progress で出し、ここでは作らない）
// - 動きは位置・大きさ・濃さだけ。動きを減らす設定では、塗り終わった形で止める
// - 絵は、ドヤくんの共通部品 DoyaKun（ds/kun）の paint-a・paint-b・paint-done（public/character/<ポーズ>-512.webp）。
//   作業中は paint-a と paint-b を入れ替えて、ローラーを上げ下げしているように見せる。できたら paint-done（親指を立てる）
//   絵の作り方は docs/design/images/working-bear/PROMPTS.md
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { DoyaKun } from '@/components/ds/kun'
import styles from './DoyaWorking.module.css'

export interface WorkingColors {
  primary: string
  secondary: string
  accent: string
}

const DEFAULT_COLORS: WorkingColors = { primary: '#0066ff', secondary: '#0a0f3c', accent: '#ffd400' }
const HEX = /^#[0-9a-fA-F]{6}$/
const pick = (c: string | undefined, fallback: string) => (c && HEX.test(c) ? c : fallback)

const STEP_MS = 2800

export default function DoyaWorking({ title, caption, steps, colors, progress, done = false, compact = false, className }: {
  /** いま何を作っているか（例: 面の画像を作っています） */
  title: ReactNode
  /** 補足（例: できた面から3Dに貼られます） */
  caption?: ReactNode
  /** 順に入れ替えて出す一言 */
  steps?: string[]
  /** 塗る色（ブランドの色）。無いときはドヤAIの青 */
  colors?: Partial<WorkingColors>
  /** 進み具合（0〜1）。無いときは、塗って戻す動きを繰り返す */
  progress?: number
  /** 作り終わった（ドヤくんが親指を立てる） */
  done?: boolean
  /** 小さく出す（確認の画面の中など） */
  compact?: boolean
  className?: string
}) {
  const c: WorkingColors = {
    primary: pick(colors?.primary, DEFAULT_COLORS.primary),
    secondary: pick(colors?.secondary, DEFAULT_COLORS.secondary),
    accent: pick(colors?.accent, DEFAULT_COLORS.accent),
  }
  const [step, setStep] = useState(0)
  useEffect(() => {
    if (!steps || steps.length < 2 || done) return
    const t = setInterval(() => setStep((n) => (n + 1) % steps.length), STEP_MS)
    return () => clearInterval(t)
  }, [steps, done])

  const measured = typeof progress === 'number' && Number.isFinite(progress)
  const p = measured ? Math.max(0, Math.min(1, progress as number)) : 0
  const style = { '--w-primary': c.primary, '--w-secondary': c.secondary, '--w-accent': c.accent, '--w-p': p } as CSSProperties

  return (
    <div
      className={`${styles.root} ${compact ? styles.compact : ''} ${className ?? ''}`}
      data-state={done ? 'done' : 'working'}
      data-mode={measured ? 'measured' : 'loop'}
      style={style}
    >
      <div className={styles.stage} aria-hidden>
        {/* 塗る壁（ブース全体の決まりと同じ形。上の3割は見出し用の主色の帯、斜めの帯と円、下は落ち着いた面） */}
        <div className={styles.panel}>
          <div className={styles.paint} style={measured && !done ? { clipPath: `inset(0 0 ${(1 - p) * 100}% 0)` } : undefined}>
            <svg viewBox="0 0 120 160" width="100%" height="100%" preserveAspectRatio="none">
              <rect width="120" height="160" fill="#f4f7fd" />
              <polygon points="0,112 120,76 120,108 0,144" fill={c.accent} opacity="0.95" />
              <circle cx="92" cy="104" r="22" fill={c.secondary} opacity="0.92" />
              <rect width="120" height="50" fill={c.primary} />
              <rect x="10" y="14" width="64" height="7" rx="3.5" fill="#fff" opacity="0.9" />
              <rect x="10" y="27" width="42" height="5" rx="2.5" fill="#fff" opacity="0.6" />
            </svg>
          </div>
          <div className={styles.roller} style={measured && !done ? { transform: `translateY(${p * 100}%)` } : undefined}>
            <span className={styles.rollerBar} />
            <span className={styles.drop} />
            <span className={styles.drop} />
            <span className={styles.drop} />
          </div>
          <i className={styles.spark} />
          <i className={styles.spark} />
        </div>
        <div className={styles.bear}>
          {/* 3枚を重ねて、濃さだけで入れ替える（act は idle。上下の動きは、この部品の bear の動きにまかせる） */}
          <span className={styles.bearA}><DoyaKun pose="paint-a" size={240} /></span>
          <span className={styles.bearB}><DoyaKun pose="paint-b" size={240} /></span>
          <span className={styles.bearDone}><DoyaKun pose="paint-done" size={240} /></span>
        </div>
      </div>
      <div className={styles.text}>
        <p className={styles.title} role="status">{title}</p>
        {caption ? <p className={styles.caption}>{caption}</p> : null}
        {steps && steps.length > 0 && !done ? <p key={step} className={styles.step} aria-hidden>{steps[step % steps.length]}</p> : null}
      </div>
    </div>
  )
}
