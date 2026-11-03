import type { AdminComparisonStatus } from './admin-stat-comparison'

export interface AnalyticsServiceStats {
  id: string
  name: string
  icon: string
  generations: number
  todayGenerations: number
  users: number | null
  userCountLabel?: string
  proUsers: number | null
  growth: number | null
  growthStatus: AdminComparisonStatus
}

export interface AdminAnalyticsData {
  lastUpdated: string
  totalGenerations: number
  todayGenerations: number
  monthGenerations: number
  lastMonthGenerations: number
  generationGrowth: number | null
  generationGrowthStatus: AdminComparisonStatus
  totalUsers: number
  premiumUsers: number
  conversionRate: number
  services: AnalyticsServiceStats[]
  chartData: number[]
}

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const count = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const comparison = (percent: unknown, status: unknown): boolean => status === 'comparable'
  ? finite(percent) && percent >= -100
  : (status === 'no-baseline' || status === 'not-measured') && percent === null
const optionalCount = (value: unknown): value is number | null => value === null || count(value)

/** 取得失敗・形式不正を実績0件に置き換えず、画面に必要な集計値を検証する。 */
export function isAdminAnalyticsData(value: unknown): value is AdminAnalyticsData {
  if (!record(value)) return false
  if (typeof value.lastUpdated !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value.lastUpdated) || !Number.isFinite(Date.parse(value.lastUpdated)) || new Date(value.lastUpdated).toISOString() !== value.lastUpdated) return false
  for (const key of ['totalGenerations', 'todayGenerations', 'monthGenerations', 'lastMonthGenerations', 'totalUsers', 'premiumUsers']) {
    if (!count(value[key])) return false
  }
  if (!comparison(value.generationGrowth, value.generationGrowthStatus) || !finite(value.conversionRate) || value.conversionRate < 0 || value.conversionRate > 100) return false
  if (value.generationGrowthStatus === 'not-measured') return false
  const previous = value.lastMonthGenerations as number
  const current = value.monthGenerations as number
  if (previous === 0) {
    if (value.generationGrowthStatus !== 'no-baseline' || value.generationGrowth !== null) return false
  } else if (value.generationGrowthStatus !== 'comparable' || value.generationGrowth !== Number((((current - previous) / previous) * 100).toFixed(1))) return false
  if ((value.premiumUsers as number) > (value.totalUsers as number)) return false
  if (!Array.isArray(value.chartData) || value.chartData.length !== 12 || !value.chartData.every(count)) return false
  if (!Array.isArray(value.services)) return false
  return value.services.every(service => record(service)
    && typeof service.id === 'string' && service.id.length > 0
    && typeof service.name === 'string' && typeof service.icon === 'string'
    && count(service.generations) && count(service.todayGenerations)
    && optionalCount(service.users) && optionalCount(service.proUsers)
    && (service.users === null || service.proUsers === null || service.proUsers <= service.users)
    && (service.userCountLabel === undefined || typeof service.userCountLabel === 'string')
    && comparison(service.growth, service.growthStatus))
}
