// 使用回数管理

const USAGE_KEY = 'doya_daily_usage'
const USAGE_DATE_KEY = 'doya_usage_date'

export type UserTier = 'guest' | 'free' | 'premium' | 'business' | 'enterprise'

export interface UsageLimits {
  daily: number
  label: string
  features: string[]
}

// 各プランの使用回数制限（バナーAIは月間上限）
export const PLAN_LIMITS: Record<UserTier, UsageLimits> = {
  guest: {
    daily: 3,
    label: 'ゲスト',
    features: ['月3枚まで無料でお試し', '基本テンプレート'],
  },
  free: {
    daily: 15,
    label: '無料プラン',
    features: ['月15枚まで生成可能', '全テンプレート', '履歴保存'],
  },
  premium: {
    daily: 150,
    label: 'プレミアム',
    features: ['月150枚まで生成可能', '全機能利用可能', '優先サポート'],
  },
  business: {
    daily: 500,
    label: 'ビジネス',
    features: ['月500枚まで生成可能', 'チーム共有機能', 'API連携'],
  },
  enterprise: {
    daily: -1, // 無制限
    label: 'エンタープライズ',
    features: ['無制限', '専任サポート', 'カスタムテンプレート'],
  },
}

// 今月のキーを取得（YYYY-MM）
function getCurrentMonthKey(): string {
  return new Date().toISOString().slice(0, 7) // YYYY-MM
}

// 使用回数を取得（月間）
export function getUsageCount(): number {
  if (typeof window === 'undefined') return 0

  const storedDate = localStorage.getItem(USAGE_DATE_KEY)
  const currentMonth = getCurrentMonthKey()

  // 月が変わっていたらリセット（旧YYYY-MM-DD形式にも対応）
  if (!storedDate || storedDate.slice(0, 7) !== currentMonth) {
    localStorage.setItem(USAGE_DATE_KEY, currentMonth)
    localStorage.setItem(USAGE_KEY, '0')
    return 0
  }

  const count = localStorage.getItem(USAGE_KEY)
  return count ? parseInt(count, 10) : 0
}

// 使用回数を増やす（月間）
export function incrementUsage(): number {
  if (typeof window === 'undefined') return 0

  const currentMonth = getCurrentMonthKey()
  const storedDate = localStorage.getItem(USAGE_DATE_KEY)

  // 月が変わっていたらリセット
  if (!storedDate || storedDate.slice(0, 7) !== currentMonth) {
    localStorage.setItem(USAGE_DATE_KEY, currentMonth)
    localStorage.setItem(USAGE_KEY, '1')
    return 1
  }

  const current = getUsageCount()
  const newCount = current + 1
  localStorage.setItem(USAGE_KEY, newCount.toString())
  return newCount
}

// 使用可能かチェック
export function canUseGeneration(tier: UserTier): boolean {
  const limit = PLAN_LIMITS[tier].daily
  if (limit === -1) return true // 無制限
  
  const current = getUsageCount()
  return current < limit
}

// 残り回数を取得
export function getRemainingCount(tier: UserTier): number | 'unlimited' {
  const limit = PLAN_LIMITS[tier].daily
  if (limit === -1) return 'unlimited'
  
  const current = getUsageCount()
  return Math.max(0, limit - current)
}


