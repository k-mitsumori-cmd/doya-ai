'use client'
// ============================================
// ds/SaveLabel — 保存ボタンの中身。保存できたら、文字がチェックの印に入れ替わる
// ============================================
// ボタンの中に置く。文字（children）とチェックを同じ場所に重ねるので、ボタンの幅は変わらない（CLS を増やさない）。
// - state は useSaveState() の値。saved のときだけチェック（CheckMark）が弾んで描かれる。error は小さく揺れる
// - 読み上げ用に「保存しました」を role=status で出す（見えない文字）。見た目の文言は変えない
// - 動きを減らす設定では、揺れ・弾みは CSS が止める。チェックは描き終わった形ですぐ出る
// 使い方: <button disabled={saving}><SaveLabel state={save.state}>保存する</SaveLabel></button>
import type { CSSProperties, ReactNode } from 'react'
import { CheckMark } from './check-mark'
import type { SaveState } from './use-save-state'
import styles from './save-label.module.css'

export function SaveLabel({ state, children, tone = 'onColor' }: {
  state: SaveState
  children: ReactNode
  /** onColor: 色のついたボタン（白い円に、ボタンの色でチェック）／ plain: 明るいボタン（濃い円に白いチェック） */
  tone?: 'onColor' | 'plain'
}) {
  const style = (tone === 'onColor' ? { '--cm-tick': 'var(--blue, #0066ff)' } : undefined) as CSSProperties | undefined
  return (
    <span className={styles.wrap} data-state={state}>
      <span className={styles.label}>{children}</span>
      {state === 'saved' ? <span className={styles.mark} style={style}><CheckMark size={20} burst /></span> : null}
      <span className={styles.sr} role="status">{state === 'saved' ? '保存しました' : ''}</span>
    </span>
  )
}
