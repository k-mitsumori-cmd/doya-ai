import { hrPlanTier } from '@/lib/hr/plan-tier'

export interface HrBillingInfo {
  plan: string
  planLabel: string
  employeeCount: number
  employeeLimit: number
  memberCount: number
  memberLimit: number
  aiUsageCount: number
  aiUsageLimit: number
  canManageBilling: boolean
}

export const HR_BILLING_READ_TIMEOUT_MS = 35_000

export function parseHrBillingInfo(value: unknown, organizationId: string): HrBillingInfo {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid HR billing response')
  const row = value as Record<string, unknown>
  const tier = hrPlanTier(row.plan)
  if (!tier || !organizationId || row.organizationId !== organizationId ||
    typeof row.planLabel !== 'string' || !row.planLabel.trim() ||
    typeof row.canManageBilling !== 'boolean') throw new Error('Invalid HR billing response')
  const count = (key: string): number => {
    const number = row[key]
    if (typeof number !== 'number' || !Number.isSafeInteger(number) || number < 0) throw new Error('Invalid HR billing response')
    return number
  }
  return {
    plan: tier.toLowerCase(), planLabel: row.planLabel,
    employeeCount: count('employeeCount'), employeeLimit: count('employeeLimit'),
    memberCount: count('memberCount'), memberLimit: count('memberLimit'),
    aiUsageCount: count('aiUsageCount'), aiUsageLimit: count('aiUsageLimit'),
    canManageBilling: row.canManageBilling,
  }
}

/** Bound both the HTTP response and body read, even if the transport ignores abort. */
export async function readHrBillingInfo(request: typeof fetch, organizationId: string, signal: AbortSignal): Promise<HrBillingInfo> {
  const controller = new AbortController()
  let interrupt!: (reason: Error) => void
  const interrupted = new Promise<never>((_, reject) => { interrupt = reject })
  const cancel = () => { controller.abort(); interrupt(new Error('HR billing read cancelled')) }
  signal.addEventListener('abort', cancel, { once: true })
  const timer = setTimeout(() => { controller.abort(); interrupt(new Error('HR billing read timed out')) }, HR_BILLING_READ_TIMEOUT_MS)
  try {
    if (signal.aborted) { cancel(); return await interrupted }
    const read = (async () => {
      const response = await request('/api/hr/usage', { signal: controller.signal })
      if (!response.ok) throw new Error('HR billing read failed')
      return parseHrBillingInfo(await response.json(), organizationId)
    })()
    return await Promise.race([read, interrupted])
  } finally {
    clearTimeout(timer)
    signal.removeEventListener('abort', cancel)
  }
}
