/**
 * 共通プランユーティリティ
 *
 * 全サービスで統一されたプラン階層判定・表示ロジック。
 * 各ページで独自にtierFrom / planLabel / planBadgeを定義するとLIGHTの漏れが発生するため、
 * 必ずこのファイルのヘルパーを使うこと。
 *
 * @see docs/LIGHT_PLAN_SPEC.md
 */

export type PlanTier = 'GUEST' | 'FREE' | 'LIGHT' | 'PRO' | 'ENTERPRISE'

/**
 * 生のプラン文字列からPlanTierに正規化する。
 * BANNER_PRO / PRO_MONTHLY / BASIC / STARTER / BUSINESS などの揺れに対応。
 */
export function tierFrom(raw: unknown): PlanTier {
  const p = String(raw || '').toUpperCase()
  if (!p || p === 'GUEST') return 'GUEST'
  if (p.includes('ENTERPRISE')) return 'ENTERPRISE'
  if (p.includes('PRO') || p.includes('BASIC') || p.includes('STARTER') || p.includes('BUSINESS')) return 'PRO'
  if (p.includes('LIGHT')) return 'LIGHT'
  if (p.includes('FREE')) return 'FREE'
  return 'FREE'
}

/**
 * PlanTierの日本語表示ラベルを返す。
 */
export function planLabel(tier: PlanTier): string {
  switch (tier) {
    case 'GUEST': return 'ゲスト'
    case 'FREE': return '無料'
    case 'LIGHT': return 'ライト'
    case 'PRO': return 'プロ'
    case 'ENTERPRISE': return 'エンタープライズ'
  }
}

/** 階層の強さ。higherPlan の比較に使う。 */
const TIER_RANK: Record<PlanTier, number> = {
  GUEST: 0,
  FREE: 1,
  LIGHT: 2,
  PRO: 3,
  ENTERPRISE: 4,
}

/**
 * 2つのプラン文字列のうち**上位**の tier を返す。
 *
 * なぜ必要か（2026-08 障害）:
 *   統一プランの権利は User.plan が唯一の真実だが、UserServiceSubscription.plan を
 *   優先して読む古い経路が残っている（session.user.seoPlan など）。消費側は
 *   `user.seoPlan || user.plan` の形で書かれており **'FREE' は truthy** なので、
 *   サービス行の書き込みが1つでも失敗すると、User.plan が PRO でもそのサービスだけ
 *   無料に落ちる。上位採用にしておけば、行が古くても・欠けていても権利を失わない。
 *   逆に管理画面で個別サービスにだけ上位プランを付与したケースも失われない。
 */
export function higherPlan(a: unknown, b: unknown): PlanTier {
  const ta = tierFrom(a ?? 'FREE')
  const tb = tierFrom(b ?? 'FREE')
  return TIER_RANK[ta] >= TIER_RANK[tb] ? ta : tb
}

/**
 * PlanTierに対応するバッジ情報（text + CSSクラス）を返す。
 */
export function planBadge(tier: PlanTier): { text: string; cls: string } {
  switch (tier) {
    case 'ENTERPRISE':
      return { text: 'ENTERPRISE', cls: 'bg-rose-600 text-white shadow-sm shadow-rose-600/20' }
    case 'PRO':
      return { text: 'PRO', cls: 'bg-orange-500 text-white shadow-sm shadow-orange-500/20' }
    case 'LIGHT':
      return { text: 'LIGHT', cls: 'bg-blue-500 text-white shadow-sm shadow-blue-500/20' }
    case 'FREE':
      return { text: 'FREE', cls: 'bg-blue-100 text-blue-700' }
    case 'GUEST':
    default:
      return { text: 'GUEST', cls: 'bg-gray-200 text-gray-700' }
  }
}

/**
 * PlanTierに対応する月額料金を返す（円）。
 */
export function planPrice(tier: PlanTier): number {
  switch (tier) {
    case 'ENTERPRISE': return 49800
    case 'PRO': return 9980
    case 'LIGHT': return 2980
    default: return 0
  }
}

/**
 * 有料プランかどうかを判定する。
 */
export function isPaidTier(tier: PlanTier): boolean {
  return tier === 'LIGHT' || tier === 'PRO' || tier === 'ENTERPRISE'
}

/**
 * dispatchEvent用のplanTier判定。
 * planIdの文字列からPlanTierを推定する。
 */
export function tierFromPlanId(planId: string): PlanTier {
  const p = String(planId || '').toLowerCase()
  if (p.includes('enterprise')) return 'ENTERPRISE'
  if (p.includes('light')) return 'LIGHT'
  if (p.includes('pro') || p.includes('basic') || p.includes('starter') || p.includes('business')) return 'PRO'
  return 'FREE'
}
