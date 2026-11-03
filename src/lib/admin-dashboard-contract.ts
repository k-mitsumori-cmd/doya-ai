import { isAdminAnalyticsData, type AdminAnalyticsData, type AnalyticsServiceStats } from './admin-analytics-contract'

interface DashboardService extends AnalyticsServiceStats {
  revenue: number | null
  gradient: string
  dashboardHref?: string | null
  isRetired?: boolean
}
export interface AdminDashboardData extends AdminAnalyticsData {
  enterpriseUsers: number
  freeUsers: number
  registeredPlanTiers?: Record<'GUEST' | 'FREE' | 'LIGHT' | 'PRO' | 'ENTERPRISE', number>
  recentUsers: number
  recentGenerations: Array<{ id: string; userName: string; service: string; action: string; createdAt: string }>
  adminLoginAttempts: number
  services: DashboardService[]
}
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const count = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
const timestamp = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value

/** ダッシュボードの表示値も検証し、不正な応答を実績として描画しない。 */
export function isAdminDashboardData(value: unknown): value is AdminDashboardData {
  if (!isAdminAnalyticsData(value) || !record(value)) return false
  for (const key of ['enterpriseUsers', 'freeUsers', 'recentUsers', 'adminLoginAttempts']) if (!count(value[key])) return false
  if (value.freeUsers !== value.totalUsers - value.premiumUsers) return false
  if (value.registeredPlanTiers !== undefined) {
    const tiers = value.registeredPlanTiers
    if (!record(tiers) || !['GUEST', 'FREE', 'LIGHT', 'PRO', 'ENTERPRISE'].every(key => count(tiers[key]))) return false
    if (Number(tiers.GUEST) + Number(tiers.FREE) + Number(tiers.LIGHT) + Number(tiers.PRO) + Number(tiers.ENTERPRISE) !== value.totalUsers) return false
    if (Number(tiers.LIGHT) + Number(tiers.PRO) + Number(tiers.ENTERPRISE) !== value.premiumUsers) return false
  }
  if (!value.services.every(service => {
    const extra = service as unknown as Record<string, unknown>
    return (extra.revenue === null || (typeof extra.revenue === 'number' && Number.isFinite(extra.revenue) && extra.revenue >= 0)) && typeof extra.gradient === 'string' && (extra.isRetired === undefined || typeof extra.isRetired === 'boolean')
      && (extra.dashboardHref === undefined || extra.dashboardHref === null || (typeof extra.dashboardHref === 'string' && /^\/(?!\/)/.test(extra.dashboardHref) && !/[\\\u0000-\u0020]/.test(extra.dashboardHref)))
  })) return false
  return Array.isArray(value.recentGenerations) && value.recentGenerations.every(activity => record(activity)
    && ['id', 'userName', 'service', 'action'].every(key => typeof activity[key] === 'string') && timestamp(activity.createdAt))
}
