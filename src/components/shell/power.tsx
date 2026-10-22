'use client'
// ============================================
// 共通の枠のドヤパワー（残りの小さなゲージと、ボタンの減る量）
// ============================================
// 置き場所だけを用意する。値はサーバーが決めて props → context で渡す。ここで台帳や API を読まない。
// - 旗（DOYA_POWER_ROLLOUT）が出さないと決めた人には、何も描かない（useDoyaPower()）
// - 旗が出すと決めても、残りの値（balance）が渡されていなければ、何も描かない
//   ⚠️ 残りを返す API（/api/doya-power/balance）と台帳の表は、本番DBに表が入ってから作る。それまでは (shell)/layout.tsx が null を渡す
// - ボタンの減る量は、操作の名前（例: 'banner.generate'）から引く。表（costs）が空なら、札は出ない
//   ⚠️ 減る量の数は、ここで決めない（台帳の決まり src/lib/doya-power/rules.ts と合わせて、統括が決める）
import Link from 'next/link'
import { createContext, useContext, type ReactNode } from 'react'
import { Zap } from 'lucide-react'
import { CostBadge } from '@/components/ds/cost-badge'
import { useDoyaPower } from '@/components/doya-power/doya-power-context'
import styles from './power.module.css'

export interface ShellPowerBalance {
  /** 残り */
  remaining: number
  /** 上限（回復したときの量） */
  limit: number
}

export interface ShellPowerState {
  balance: ShellPowerBalance | null
  /** 操作の名前 → 1回で減る量 */
  costs: Record<string, number>
}

const EMPTY: ShellPowerState = { balance: null, costs: {} }
export const ShellPowerContext = createContext<ShellPowerState>(EMPTY)

export function ShellPowerProvider({ value, children }: { value?: ShellPowerState | null; children: ReactNode }) {
  return <ShellPowerContext.Provider value={value ?? EMPTY}>{children}</ShellPowerContext.Provider>
}

const fmt = (n: number) => Math.max(0, Math.round(n)).toLocaleString('ja-JP')

/** 枠のヘッダーに置く、残りの小さなゲージ。押すと経営ホームのドヤパワーの欄へ移る */
export function ShellPowerMeter({ className, href = '/home#doya-power', variant = 'topbar' }: {
  className?: string
  href?: string
  /** topbar … スマホの上の帯 / sidebar … 左のメニューの上（アイコンだけの幅では稲妻だけ） */
  variant?: 'topbar' | 'sidebar'
}) {
  const enabled = useDoyaPower()
  const { balance } = useContext(ShellPowerContext)
  if (!enabled || !balance) return null
  const max = Math.max(0, balance.limit)
  const value = Math.min(Math.max(0, balance.remaining), max)
  const ratio = max > 0 ? value / max : 0
  const low = ratio < 0.2
  return (
    <Link
      href={href}
      className={`${styles.meter} ${variant === 'sidebar' ? styles.sidebarMeter : ''} ${className ?? ''}`}
      data-low={low ? 'true' : undefined}
      aria-label={`ドヤパワーの残り ${fmt(value)}（上限 ${fmt(max)}）${low ? '。残りわずかです' : ''}`}
      title={`ドヤパワーの残り ${fmt(value)} / 上限 ${fmt(max)}`}
    >
      <Zap size={14} strokeWidth={2.25} aria-hidden className={styles.icon} />
      <span className={styles.num} aria-hidden>{fmt(value)}</span>
      {/* 幅を決めた棒（あとから幅が変わらない。CLS を増やさない） */}
      <span className={styles.track} aria-hidden><span className={styles.fill} style={{ width: `${Math.round(ratio * 100)}%` }} /></span>
    </Link>
  )
}

/**
 * ツールの生成のボタンに入れる、減る量の札。<Button>バナーを作る<ShellCostBadge action="banner.generate" /></Button>
 * 表に無い操作・旗が off・残りが分からないときは、何も描かない
 */
export function ShellCostBadge({ action, className }: { action: string; className?: string }) {
  const { balance, costs } = useContext(ShellPowerContext)
  const cost = costs[action]
  if (cost === undefined || !Number.isFinite(cost)) return null
  // CostBadge 自身も旗を見る（off なら何も描かない）
  return <CostBadge cost={cost} short={balance ? balance.remaining < cost : false} className={className} />
}
