import { isPaidPlan } from '@/lib/unified-plan'
import { tierFrom } from '@/lib/plan-utils'

export type HrPlanTier = 'FREE' | 'LIGHT' | 'PRO' | 'ENTERPRISE'

/** Validate known User.plan codes, then use the canonical DB/session tier projection. */
export function hrPlanTier(plan: unknown): HrPlanTier | null {
  if (typeof plan !== 'string') return null
  const code = plan.trim().toUpperCase()
  if (code === 'FREE' || code === 'GUEST') return 'FREE'
  if (!isPaidPlan(code)) return null
  const tier = tierFrom(code)
  return tier === 'LIGHT' || tier === 'PRO' || tier === 'ENTERPRISE' ? tier : null
}
