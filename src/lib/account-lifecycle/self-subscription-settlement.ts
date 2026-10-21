import { LifecycleError } from './state'
import type { SubscriptionPlan } from './subscription-plan'

/** Additive evidence; v1 plan bytes and digest never change. Presence alone is not a projection result. */
export type SelfSettlementRequirement = {
  version: 1; source: 'self_service'; policyVersion: 1; operationId: string
  operator: { kind: 'user'; id: string }; targetHash: string; planDigest: string
  identity: SubscriptionPlan['identity']; mode: 'test' | 'live'
}
export type SelfSettlementCoverage = {
  version: 1; source: 'self_service'; policyVersion: 1; operationId: string
  targetHash: string; planDigest: string; userPlan: 'FREE' | 'LIGHT' | 'PRO' | 'BUNDLE' | 'ENTERPRISE'
  appliedAt: string
}
export const selfSettlementRequirementKey = (operationId: string) => `doya-subscription-settlement-required:v1:${operationId}`
export const selfSettlementCoverageKey = (operationId: string) => `doya-subscription-settlement-applied:v1:${operationId}`
const bad = (): never => { throw new LifecycleError('SUBSCRIPTION_SETTLEMENT_UNAVAILABLE') }
const exact = (value: unknown, fields: string[]) => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).sort().join(',') === [...fields].sort().join(',')

export function makeSelfSettlementRequirement(plan: SubscriptionPlan): SelfSettlementRequirement {
  if (plan.identity.kind !== 'cancel' || plan.cancelMode !== 'immediate' || plan.identity.operator.kind !== 'user') return bad()
  return { version: 1, source: 'self_service', policyVersion: 1, operationId: plan.identity.operationId,
    operator: { kind: 'user', id: plan.identity.operator.id }, targetHash: plan.targetHash,
    planDigest: plan.inputDigest, identity: JSON.parse(JSON.stringify(plan.identity)), mode: plan.mode }
}

export function readSelfSettlementRequirement(plan: SubscriptionPlan, raw: string): SelfSettlementRequirement {
  if (typeof raw !== 'string' || Buffer.byteLength(raw) > 2048) return bad()
  let value: unknown
  try { value = JSON.parse(raw) } catch { return bad() }
  const expected = makeSelfSettlementRequirement(plan)
  if (!exact(value, Object.keys(expected)) || JSON.stringify(value) !== JSON.stringify(expected)) return bad()
  return expected
}

export function readSelfSettlementCoverage(plan: SubscriptionPlan, raw: string): SelfSettlementCoverage {
  if (typeof raw !== 'string' || Buffer.byteLength(raw) > 2048) return bad()
  let value: unknown
  try { value = JSON.parse(raw) } catch { return bad() }
  if (!exact(value, ['version', 'source', 'policyVersion', 'operationId', 'targetHash', 'planDigest', 'userPlan', 'appliedAt'])) return bad()
  const coverage = value as SelfSettlementCoverage
  if (coverage.version !== 1 || coverage.source !== 'self_service' || coverage.policyVersion !== 1 ||
      coverage.operationId !== plan.identity.operationId || coverage.targetHash !== plan.targetHash ||
      coverage.planDigest !== plan.inputDigest ||
      !['FREE', 'LIGHT', 'PRO', 'BUNDLE', 'ENTERPRISE'].includes(coverage.userPlan) ||
      typeof coverage.appliedAt !== 'string' || !Number.isFinite(Date.parse(coverage.appliedAt)) ||
      new Date(coverage.appliedAt).toISOString() !== coverage.appliedAt) return bad()
  return coverage
}
