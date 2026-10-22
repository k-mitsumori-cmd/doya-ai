import { createHash } from 'node:crypto'
import {
  LifecycleError, assertLifecycleIdentity, lifecycleActionKey, lifecycleSubject,
  validLifecycleDigest, type LifecycleIdentity, type LifecycleResource,
} from './state'

export type AdminSubscriptionIntent = 'period_end_cancel' | 'immediate_cancel' | 'resume'
export type AdminSubscriptionTarget = {
  id: string; customerId: string; status: 'active' | 'trialing' | 'past_due'
  cancelAtPeriodEnd: boolean; currentPeriodEnd: number
}
export type AdminSubscriptionPlan = {
  version: 1; source: 'admin'; settlementPolicyVersion: 1
  identity: LifecycleIdentity; targetHash: string; inputDigest: string
  intent: AdminSubscriptionIntent; mode: 'test' | 'live'
  email: string; expectedCustomerId: string | null; expectedSubscriptionId: string
  expectedPriceId: string | null; target: AdminSubscriptionTarget
}

export const adminSubscriptionPlanKey = (operationId: string) => `doya-admin-subscription-plan:v1:${operationId}`
export const adminSubscriptionFactKey = (operationId: string) => `doya-admin-subscription-fact:v1:${operationId}`
export const adminSubscriptionSettlementKey = (operationId: string) => `doya-admin-subscription-settlement:v1:${operationId}`
export type AdminSubscriptionSettlement = {
  version: 1; source: 'admin'; settlementPolicyVersion: 1
  operationId: string; targetHash: string; planDigest: string
  projected: boolean; userPlan: string | null; appliedAt: string
}
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const fail = (): never => { throw new LifecycleError('ADMIN_SUBSCRIPTION_PLAN_UNAVAILABLE') }
const exact = (value: unknown, fields: string[]) => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).sort().join(',') === [...fields].sort().join(',')
const ref = (value: unknown, prefix: string) => typeof value === 'string' && new RegExp(`^${prefix}_[A-Za-z0-9_]{1,150}$`).test(value)

function payload(plan: Omit<AdminSubscriptionPlan, 'inputDigest' | 'targetHash'>) {
  return [plan.version, plan.source, plan.settlementPolicyVersion, plan.identity, plan.intent,
    plan.mode, plan.email, plan.expectedCustomerId, plan.expectedSubscriptionId, plan.expectedPriceId, plan.target]
}

export function makeAdminSubscriptionPlan(value: Omit<AdminSubscriptionPlan, 'version' | 'source' | 'settlementPolicyVersion' | 'targetHash' | 'inputDigest'>): AdminSubscriptionPlan {
  const frozen = JSON.parse(JSON.stringify(value)) as typeof value
  const base = { version: 1 as const, source: 'admin' as const, settlementPolicyVersion: 1 as const, ...frozen }
  const plan = { ...base, targetHash: lifecycleSubject(base.identity.targetUserId), inputDigest: digest(payload(base)) }
  parseAdminSubscriptionPlan(JSON.stringify(plan))
  return plan
}

export function parseAdminSubscriptionPlan(raw: string): AdminSubscriptionPlan {
  if (typeof raw !== 'string' || Buffer.byteLength(raw) > 8192) return fail()
  let value: unknown
  try { value = JSON.parse(raw) } catch { return fail() }
  if (!exact(value, ['version', 'source', 'settlementPolicyVersion', 'identity', 'targetHash', 'inputDigest',
    'intent', 'mode', 'email', 'expectedCustomerId', 'expectedSubscriptionId', 'expectedPriceId', 'target'])) return fail()
  const p = value as AdminSubscriptionPlan
  try { assertLifecycleIdentity(p.identity) } catch { return fail() }
  if (p.version !== 1 || p.source !== 'admin' || p.settlementPolicyVersion !== 1 ||
      p.identity.operator.kind !== 'admin' ||
      p.identity.kind !== (p.intent === 'resume' ? 'resume' : 'cancel') ||
      !['period_end_cancel', 'immediate_cancel', 'resume'].includes(p.intent) ||
      p.targetHash !== lifecycleSubject(p.identity.targetUserId) || !validLifecycleDigest(p.inputDigest) ||
      !['test', 'live'].includes(p.mode) || typeof p.email !== 'string' || p.email !== p.email.trim().toLowerCase() ||
      p.email.length < 3 || p.email.length > 320 || !p.email.includes('@') ||
      !(p.expectedCustomerId === null || ref(p.expectedCustomerId, 'cus')) ||
      !ref(p.expectedSubscriptionId, 'sub') ||
      !(p.expectedPriceId === null || ref(p.expectedPriceId, 'price')) ||
      !exact(p.target, ['id', 'customerId', 'status', 'cancelAtPeriodEnd', 'currentPeriodEnd']) ||
      p.target.id !== p.expectedSubscriptionId || !ref(p.target.customerId, 'cus') ||
      !['active', 'trialing', 'past_due'].includes(p.target.status) ||
      typeof p.target.cancelAtPeriodEnd !== 'boolean' ||
      !Number.isSafeInteger(p.target.currentPeriodEnd) || p.target.currentPeriodEnd <= 0) return fail()
  const { targetHash: _h, inputDigest: _d, ...base } = p
  if (digest(payload(base)) !== p.inputDigest) return fail()
  return p
}

export function adminSubscriptionResource(plan: AdminSubscriptionPlan): LifecycleResource {
  return {
    type: plan.intent === 'resume' ? 'subscription_resume' : plan.intent === 'period_end_cancel' ? 'subscription_schedule_cancel' : 'subscription_cancel',
    mode: plan.mode, resourceId: plan.target.id,
    inputDigest: digest([plan.version, plan.source, plan.inputDigest, plan.target]),
  }
}
export const adminSubscriptionActionKey = (plan: AdminSubscriptionPlan) => lifecycleActionKey(adminSubscriptionResource(plan))

export function readAdminSubscriptionSettlement(plan: AdminSubscriptionPlan, raw: string): AdminSubscriptionSettlement {
  if (typeof raw !== 'string' || Buffer.byteLength(raw) > 2048) return fail()
  let value: unknown
  try { value = JSON.parse(raw) } catch { return fail() }
  if (!exact(value, ['version', 'source', 'settlementPolicyVersion', 'operationId', 'targetHash', 'planDigest',
    'projected', 'userPlan', 'appliedAt'])) return fail()
  const settled = value as AdminSubscriptionSettlement
  if (settled.version !== 1 || settled.source !== 'admin' || settled.settlementPolicyVersion !== plan.settlementPolicyVersion ||
      settled.operationId !== plan.identity.operationId || settled.targetHash !== plan.targetHash ||
      settled.planDigest !== plan.inputDigest || settled.projected !== (plan.intent === 'immediate_cancel') ||
      !(settled.userPlan === null || ['FREE', 'LIGHT', 'PRO', 'BUNDLE', 'ENTERPRISE'].includes(settled.userPlan)) ||
      settled.projected !== (settled.userPlan !== null) ||
      typeof settled.appliedAt !== 'string' || !Number.isFinite(Date.parse(settled.appliedAt)) ||
      new Date(settled.appliedAt).toISOString() !== settled.appliedAt) return fail()
  return settled
}
