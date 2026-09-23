import type { PlanTier } from '@/lib/plan-utils'

export interface CunningLimits {
  tier: PlanTier
  maxMinutesPerMonth: number // -1 = unlimited
  maxKnowledgeBases: number // -1 = unlimited
}

export const CUNNING_LIMITS: Record<PlanTier, CunningLimits> = {
  GUEST: { tier: 'GUEST', maxMinutesPerMonth: 0, maxKnowledgeBases: 0 },
  FREE: { tier: 'FREE', maxMinutesPerMonth: 60, maxKnowledgeBases: 1 },
  LIGHT: { tier: 'LIGHT', maxMinutesPerMonth: 20 * 60, maxKnowledgeBases: -1 },
  PRO: { tier: 'PRO', maxMinutesPerMonth: 20 * 60, maxKnowledgeBases: -1 },
  ENTERPRISE: { tier: 'ENTERPRISE', maxMinutesPerMonth: -1, maxKnowledgeBases: -1 },
}
