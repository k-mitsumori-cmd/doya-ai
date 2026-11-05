export interface ServiceSubscription {
  id: string
  serviceId: string
  plan: string
  dailyUsage: number
  monthlyUsage: number
  lastUsageReset: string
  hasStripe: boolean
}

export interface StripeInfo {
  status: string
  currentPeriodStart: string
  currentPeriodEnd: string
  cancelAtPeriodEnd: boolean
  canceledAt: string | null
  created: string
  amount: number
  priceSummary?: unknown
  interval: string
}

export interface AdminUser {
  id: string
  name: string | null
  email: string | null
  image: string | null
  plan: string
  role: string
  createdAt: string
  updatedAt: string
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  stripeInfo: StripeInfo | null
  totalGenerations: number
  bannerQuota: { used: number; limit: number; remaining: number | null }
  seoQuota: { used: number; limit: number; remaining: number | null }
  serviceSubscriptions: ServiceSubscription[]
  services: string[]
}

export class AdminUsersReadError extends Error {
  constructor(public readonly reason: 'unauthorized' | 'timeout' | 'cancelled' | 'invalid' | 'failed') {
    super('Admin user list could not be confirmed')
  }
}

const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)
const text = (v: unknown): v is string => typeof v === 'string'
const nullableText = (v: unknown): boolean => v === null || text(v)
const count = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0
const date = (v: unknown): boolean => text(v) && Number.isFinite(Date.parse(v))
const quota = (v: unknown): boolean => record(v) && count(v.used)
  && typeof v.limit === 'number' && Number.isSafeInteger(v.limit) && v.limit >= -1
  && (v.limit === -1 ? v.remaining === null : count(v.remaining) && v.remaining === Math.max(0, v.limit - v.used))

/** Reject malformed records before they enable administrator controls. */
export function isAdminUserList(value: unknown): value is AdminUser[] {
  if (!Array.isArray(value)) return false
  const ids = new Set<string>()
  return value.every(v => {
    if (!record(v) || !text(v.id) || !v.id || ids.has(v.id)) return false
    ids.add(v.id)
    if (!['name', 'email', 'image', 'stripeCustomerId', 'stripeSubscriptionId'].every(k => nullableText(v[k]))) return false
    if (!text(v.plan) || !text(v.role) || !date(v.createdAt) || !date(v.updatedAt) || !count(v.totalGenerations)) return false
    if (!quota(v.bannerQuota) || !quota(v.seoQuota) || !Array.isArray(v.services) || !v.services.every(text)) return false
    if (!Array.isArray(v.serviceSubscriptions) || !v.serviceSubscriptions.every(s => record(s)
      && text(s.id) && text(s.serviceId) && text(s.plan) && count(s.dailyUsage) && count(s.monthlyUsage)
      && date(s.lastUsageReset) && typeof s.hasStripe === 'boolean')) return false
    if (v.stripeInfo === null) return true
    const s = v.stripeInfo
    return record(s) && text(s.status) && text(s.interval) && count(s.amount)
      && typeof s.cancelAtPeriodEnd === 'boolean' && date(s.currentPeriodStart) && date(s.currentPeriodEnd)
      && date(s.created) && (s.canceledAt === null || date(s.canceledAt))
  })
}

/** One deadline covers HTTP and JSON body, even if cancellation is ignored. */
export async function readAdminUsers(signal: AbortSignal): Promise<AdminUser[]> {
  if (signal.aborted) throw new AdminUsersReadError('cancelled')
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  let cancel: () => void = () => {}
  const stop = new Promise<never>((_, reject) => {
    cancel = () => { controller.abort(); reject(new AdminUsersReadError('cancelled')) }
    signal.addEventListener('abort', cancel, { once: true })
    timer = setTimeout(() => { controller.abort(); reject(new AdminUsersReadError('timeout')) }, 35_000)
    if (signal.aborted) cancel()
  })
  const work = (async () => {
    if (controller.signal.aborted) throw new AdminUsersReadError('cancelled')
    const response = await fetch('/api/admin/users', { method: 'GET', credentials: 'include', cache: 'no-store', signal: controller.signal })
    if (response.status === 401) throw new AdminUsersReadError('unauthorized')
    if (!response.ok) throw new AdminUsersReadError('failed')
    const data: unknown = await response.json()
    if (controller.signal.aborted) throw new AdminUsersReadError('cancelled')
    if (!isAdminUserList(data)) throw new AdminUsersReadError('invalid')
    return data
  })()
  try {
    return await Promise.race([work, stop])
  } catch (error) {
    if (error instanceof AdminUsersReadError) throw error
    throw new AdminUsersReadError('failed')
  } finally {
    clearTimeout(timer)
    signal.removeEventListener('abort', cancel)
    controller.abort()
  }
}
