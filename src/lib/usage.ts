// 使用回数管理

const USAGE_KEY = 'doya_daily_usage'
const USAGE_DATE_KEY = 'doya_usage_date'

export type UserTier = 'guest' | 'free' | 'premium' | 'business' | 'enterprise'

export interface UsageLimits {
  daily: number
  label: string
  features: string[]
}

// 各プランの使用回数制限
export const PLAN_LIMITS: Record<UserTier, UsageLimits> = {
  guest: {
    daily: 3,
    label: 'ゲスト',
    features: ['1日3回まで無料でお試し', '基本テンプレート10種類'],
  },
  free: {
    daily: 10,
    label: '無料プラン',
    features: ['1日10回まで生成可能', '全68テンプレート', '履歴保存'],
  },
  premium: {
    daily: 100,
    label: 'プレミアム',
    features: ['1日100回まで生成可能', '全機能利用可能', '優先サポート'],
  },
  business: {
    daily: 500,
    label: 'ビジネス',
    features: ['1日500回まで生成可能', 'チーム共有機能', 'API連携'],
  },
  enterprise: {
    daily: -1, // 無制限
    label: 'エンタープライズ',
    features: ['無制限', '専任サポート', 'カスタムテンプレート'],
  },
}

// 今日の日付を取得
function getTodayKey(): string {
  return new Date().toISOString().split('T')[0]
}

// 使用回数を取得
export function getUsageCount(): number {
  if (typeof window === 'undefined') return 0
  
  const storedDate = localStorage.getItem(USAGE_DATE_KEY)
  const today = getTodayKey()
  
  // 日付が変わっていたらリセット
  if (storedDate !== today) {
    localStorage.setItem(USAGE_DATE_KEY, today)
    localStorage.setItem(USAGE_KEY, '0')
    return 0
  }
  
  const count = localStorage.getItem(USAGE_KEY)
  return count ? parseInt(count, 10) : 0
}

// 使用回数を増やす
export function incrementUsage(): number {
  if (typeof window === 'undefined') return 0
  
  const today = getTodayKey()
  const storedDate = localStorage.getItem(USAGE_DATE_KEY)
  
  // 日付が変わっていたらリセット
  if (storedDate !== today) {
    localStorage.setItem(USAGE_DATE_KEY, today)
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


