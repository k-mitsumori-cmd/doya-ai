'use client'
// ============================================
// 共通の枠のドヤパワー（残りの小さなゲージと、ボタンの減る量）
// ============================================
// 置き場所だけを用意する。値はサーバーが決めて props → context で渡す。ここで台帳や API を読まない。
// - 旗（DOYA_POWER_ROLLOUT）が出さないと決めた人には、何も描かない（useDoyaPower()）
// - 旗が出すと決めても、残りの値（balance）が渡されていなければ、何も描かない
//   ⚠️ 残りを返す API（/api/doya-power/balance）と台帳の表は、本番DBに表が入ってから作る。それまでは (shell)/layout.tsx が null を渡す
// - ボタンの減る量は、操作の名前（例: 'banner.generate'）で src/lib/doya-power/costs.ts の表から引く（仮・2026-10-23）
//   ⚠️ 数はここに書かない。サーバーから costs を渡したときだけ、そちらを先に使う
import Link from 'next/link'
import { createContext, useContext, type ReactNode } from 'react'
import { Zap } from 'lucide-react'
import { CostBadge } from '@/components/ds/cost-badge'
import { useDoyaPower } from '@/components/doya-power/doya-power-context'
import { doyaPowerCost, type DoyaPowerAction } from '@/lib/doya-power/costs'
import { halfAmount } from '@/lib/doya-power/retry'
import styles from './power.module.css'
// 「作り直す」の retryOf（5分以内なら半分）。画面は ShellCostBadge と同じくここから使う（中で旗を見る）
export { useDoyaPowerRetry } from '@/components/doya-power/use-retry'

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

/** 枠のヘッダーに置く、残りの小さなゲージ。ドヤパワーの入口で、押すと内訳と履歴の画面（/home/doya-power）へ移る */
export function ShellPowerMeter({ className, href = '/home/doya-power', variant = 'topbar' }: {
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
      aria-label={`ドヤパワーの残り ${fmt(value)}（上限 ${fmt(max)}）${low ? '。残りわずかです' : ''}。内訳と履歴を見る`}
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
 * ツールの生成のボタンに入れる、減る量の札。<button>バナーを作る<ShellCostBadge action="banner.generate" /></button>
 * - 旗が off の人には何も描かない（ボタンの幅も今と同じ）。表に無い操作・減る量が 0 の操作も描かない
 * - units: 件数（AIO の質問の数など）。per: 単位あたりの量のときの単位（'分' など）
 * - retry: 5分以内の作り直しのとき true（useDoyaPowerRetry() の halved）。半分（切り上げ）の量と「半分」を出す。
 *   ⚠️ 目安の表示。実際に半分にするかはサーバーが台帳で決める（同じ会社・同じ操作の名前・5分以内・戻していない前の操作）
 */
export function ShellCostBadge({ action, units, per, retry = false, className }: { action: DoyaPowerAction; units?: number; per?: string; retry?: boolean; className?: string }) {
  const enabled = useDoyaPower()
  const { balance, costs } = useContext(ShellPowerContext)
  if (!enabled) return null
  const n = units ?? 1
  const cost = costs[action] !== undefined ? costs[action] * n : doyaPowerCost(action, n)
  if (cost === null || !Number.isFinite(cost) || cost <= 0) return null
  const shown = retry ? halfAmount(cost) : cost
  // CostBadge 自身も旗を見る（off なら何も描かない）
  return <CostBadge cost={shown} per={per} halved={retry} short={balance ? balance.remaining < shown : false} className={className} />
}
