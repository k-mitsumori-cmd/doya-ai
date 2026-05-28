// ========================================
// プラン定義の一元管理（管理画面用）
// ========================================
// 表示名・色・上限値はここで一元管理する
// 料金は src/lib/pricing.ts (SEO_PRICING / BUNDLE_PRICING) を参照
// ========================================

export const PLAN_KEYS = ['FREE', 'LIGHT', 'PRO', 'ENTERPRISE'] as const
export type PlanKey = typeof PLAN_KEYS[number]

export interface PlanInfo {
  key: PlanKey
  label: string          // 表示名（日本語）
  shortLabel: string     // 短縮表示用
  description: string
  color: string          // Tailwindカラー
  isPaid: boolean
  // 1日あたりの生成上限（-1 = 無制限）
  bannerDailyLimit: number
  writingDailyLimit: number
}

export const PLANS: Record<PlanKey, PlanInfo> = {
  FREE: {
    key: 'FREE',
    label: 'おためし',
    shortLabel: '無料',
    description: '5名以下の小規模チーム / 機能体験用',
    color: 'gray',
    isPaid: false,
    bannerDailyLimit: 9,
    writingDailyLimit: 1,
  },
  LIGHT: {
    key: 'LIGHT',
    label: 'ライト',
    shortLabel: 'ライト',
    description: '小規模チーム向け',
    color: 'blue',
    isPaid: true,
    bannerDailyLimit: 50,
    writingDailyLimit: 10,
  },
  PRO: {
    key: 'PRO',
    label: 'プロ',
    shortLabel: 'プロ',
    description: '本格運用チーム向け',
    color: 'purple',
    isPaid: true,
    bannerDailyLimit: -1,
    writingDailyLimit: -1,
  },
  ENTERPRISE: {
    key: 'ENTERPRISE',
    label: 'エンタープライズ',
    shortLabel: 'Ent',
    description: '大規模組織向け',
    color: 'slate',
    isPaid: true,
    bannerDailyLimit: -1,
    writingDailyLimit: -1,
  },
}

export function getPlanLabel(key: string | null | undefined): string {
  const k = String(key || 'FREE').toUpperCase()
  return PLANS[k as PlanKey]?.label || k
}

export function formatLimit(limit: number): string {
  if (limit < 0) return '無制限'
  return limit.toLocaleString()
}

// Tailwind色 → CSSクラスマッピング
export const PLAN_COLOR_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  gray:   { bg: 'bg-gray-500/20',   text: 'text-gray-400',   border: 'border-gray-500/30' },
  blue:   { bg: 'bg-blue-500/20',   text: 'text-blue-400',   border: 'border-blue-500/30' },
  purple: { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30' },
  slate:  { bg: 'bg-slate-500/20', text: 'text-slate-400',  border: 'border-slate-500/30' },
}

export function getPlanStyle(key: string | null | undefined) {
  const k = String(key || 'FREE').toUpperCase()
  const plan = PLANS[k as PlanKey]
  if (!plan) return PLAN_COLOR_STYLES.gray
  return PLAN_COLOR_STYLES[plan.color] || PLAN_COLOR_STYLES.gray
}
