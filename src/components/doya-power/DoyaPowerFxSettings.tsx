'use client'
// ============================================
// ドヤくんの表示と演出の設定（会社・個人）
// ============================================
// - 会社の設定は、会社の持ち主だけが変えられる（canEditOrg）。個人の設定は本人だけ。
// - 会社がオフにしたものは、個人では戻せない（resolveDoyaPowerFx と同じ決まり）。
// - 変えるとすぐ画面に反映し、保存する（既定は fx-actions.ts のサーバーアクション。見本の画面は onSave で差し替える）。
// - prefers-reduced-motion のときは、設定がオンでも動かさない。その旨を文で出す。
import { useState } from 'react'
import { saveDoyaPowerFx, type SaveFxResult } from '@/lib/doya-power/fx-actions'
import type { DoyaPowerFxSetting, FxScope } from '@/lib/doya-power/fx'
import { usePrefersReducedMotion } from '@/components/ds/motion'
import { useDoyaPowerFxState } from './fx-context'
import styles from './doya-power.module.css'

type Save = (scope: FxScope, setting: { mascot: boolean; effects: boolean }) => Promise<SaveFxResult>

export default function DoyaPowerFxSettings({
  canEditOrg = false,
  onSave = saveDoyaPowerFx,
  className,
}: {
  /** 会社の設定を変えられるか（会社の持ち主） */
  canEditOrg?: boolean
  onSave?: Save
  className?: string
}) {
  const { fx, update } = useDoyaPowerFxState()
  const reduced = usePrefersReducedMotion()
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const org = { mascot: fx?.org?.mascot !== false, effects: fx?.org?.effects !== false }
  const user = { mascot: fx?.user?.mascot !== false, effects: fx?.user?.effects !== false }

  const change = async (scope: FxScope, key: keyof DoyaPowerFxSetting, value: boolean) => {
    const base = scope === 'org' ? org : user
    const next = { ...base, [key]: value }
    update?.(scope, next)
    setStatus(null)
    const r = await onSave(scope, next)
    if (r.ok) setStatus({ kind: 'ok', text: '保存しました' })
    else {
      update?.(scope, base)
      setStatus({ kind: 'error', text: r.message })
    }
  }

  const row = (scope: FxScope, key: keyof DoyaPowerFxSetting, label: string, hint: string) => {
    const mine = scope === 'org' ? org : user
    const lockedByOrg = scope === 'user' && !org[key]
    const locked = lockedByOrg || (scope === 'org' && !canEditOrg)
    return (
      <li key={`${scope}-${key}`} className={styles.fxRow}>
        <label className={styles.fxLabel} data-disabled={locked ? 'true' : undefined}>
          <input
            type="checkbox"
            className={styles.fxCheck}
            checked={mine[key] && !lockedByOrg}
            disabled={locked}
            onChange={(e) => change(scope, key, e.target.checked)}
          />
          <span className={styles.fxText}>
            <span className={styles.fxName}>{label}</span>
            <span className={styles.fxHint}>{lockedByOrg ? '会社の設定でオフになっているため、変えられません' : scope === 'org' && !canEditOrg ? '会社の持ち主だけが変えられます' : hint}</span>
          </span>
          <span className={styles.fxState} aria-hidden>{mine[key] && !lockedByOrg ? 'オン' : 'オフ'}</span>
        </label>
      </li>
    )
  }

  return (
    <section className={`${styles.fx} ${className ?? ''}`} aria-labelledby="fx-title">
      <h2 id="fx-title" className={styles.fxTitle}>ドヤくんと動きの表示</h2>
      <p className={styles.fxLead}>
        落ち着いて仕事をしたいときは、オフにできます。数字や文字は、オフにしてもそのまま出ます。
        {reduced ? ' お使いの端末は「動きを減らす」設定のため、オンでも動きは出ません。' : ''}
      </p>
      <div className={styles.fxGroups}>
        <div className={styles.fxGroup}>
          <h3 className={styles.fxGroupTitle}>会社（全員に反映）</h3>
          <ul className={styles.fxList}>
            {row('org', 'mascot', 'ドヤくんの絵を出す', '図鑑・ゲージ・知らせに出ます')}
            {row('org', 'effects', '動きの演出を出す', 'ゲージが伸びる、スタンプが押される、など')}
          </ul>
        </div>
        <div className={styles.fxGroup}>
          <h3 className={styles.fxGroupTitle}>自分だけ</h3>
          <ul className={styles.fxList}>
            {row('user', 'mascot', 'ドヤくんの絵を出す', '自分の画面だけに反映します')}
            {row('user', 'effects', '動きの演出を出す', '自分の画面だけに反映します')}
          </ul>
        </div>
      </div>
      <p className={styles.fxStatus} role="status" aria-live="polite" data-kind={status?.kind}>{status?.text ?? ''}</p>
    </section>
  )
}
