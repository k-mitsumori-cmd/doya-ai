import { createHash } from 'node:crypto'
import {
  LifecycleError, assertLifecycleIdentity, lifecycleActionKey, lifecycleSubject,
  validLifecycleDigest, type LifecycleIdentity, type LifecycleResource,
} from './state'

export type SubscriptionKind = 'cancel' | 'resume'
export type SubscriptionMode = 'test' | 'live'
export type SubscriptionTarget = {
  id: string; customerId: string; status: string; cancelAtPeriodEnd: boolean; currentPeriodEnd: number
}
export type SubscriptionPlan = {
  version: 1; source: 'self_service'; identity: LifecycleIdentity; targetHash: string
  inputDigest: string; mode: SubscriptionMode; email: string
  expectedCustomerId: string | null; expectedSubscriptionId: string | null
  serviceId: 'banner' | 'seo' | 'kantan'; cancelMode: 'period_end' | 'immediate' | null
  targets: SubscriptionTarget[]
}

export const subscriptionPlanKey = (operationId: string) => `doya-subscription-plan:v1:${operationId}`
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const invalid = (): never => { throw new LifecycleError('SUBSCRIPTION_PLAN_UNAVAILABLE') }
const exact = (value: unknown, fields: string[]) => value !== null && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join(',') === [...fields].sort().join(',')
const validRef = (value: unknown, prefix: string) => typeof value === 'string' && new RegExp(`^${prefix}_[A-Za-z0-9_]{1,150}$`).test(value)
const validTarget = (value: unknown): value is SubscriptionTarget =>
  exact(value, ['id', 'customerId', 'status', 'cancelAtPeriodEnd', 'currentPeriodEnd']) &&
  validRef((value as SubscriptionTarget).id, 'sub') && validRef((value as SubscriptionTarget).customerId, 'cus') &&
  ['active', 'trialing', 'past_due'].includes((value as SubscriptionTarget).status) &&
  typeof (value as SubscriptionTarget).cancelAtPeriodEnd === 'boolean' &&
  Number.isSafeInteger((value as SubscriptionTarget).currentPeriodEnd) && (value as SubscriptionTarget).currentPeriodEnd > 0

function planPayload(value: Omit<SubscriptionPlan, 'version' | 'source' | 'targetHash' | 'inputDigest'>) {
  return [value.identity, value.mode, value.email, value.expectedCustomerId, value.expectedSubscriptionId,
    value.serviceId, value.cancelMode, value.targets]
}

/** Freeze discovery and the current User references before crossing any DB/provider await. */
export function makeSubscriptionPlan(value: Omit<SubscriptionPlan, 'version' | 'source' | 'targetHash' | 'inputDigest'>): SubscriptionPlan {
  const frozen = JSON.parse(JSON.stringify(value)) as typeof value
  frozen.targets.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  const plan: SubscriptionPlan = {
    version: 1, source: 'self_service', ...frozen,
    targetHash: lifecycleSubject(frozen.identity.targetUserId), inputDigest: digest(planPayload(frozen)),
  }
  parseSubscriptionPlan(JSON.stringify(plan))
  return plan
}

/** A malformed/orphan plan is a conflict, never an empty namespace. */
export function parseSubscriptionPlan(raw: string): SubscriptionPlan {
  if (typeof raw !== 'string' || Buffer.byteLength(raw) > 32768) return invalid()
  let value: unknown
  try { value = JSON.parse(raw) } catch { return invalid() }
  if (!exact(value, ['version', 'source', 'identity', 'targetHash', 'inputDigest', 'mode', 'email', 'expectedCustomerId', 'expectedSubscriptionId', 'serviceId', 'cancelMode', 'targets'])) return invalid()
  const p = value as SubscriptionPlan
  try { assertLifecycleIdentity(p.identity) } catch { return invalid() }
  if (p.version !== 1 || p.source !== 'self_service' || !['cancel', 'resume'].includes(p.identity.kind) ||
      p.targetHash !== lifecycleSubject(p.identity.targetUserId) || !validLifecycleDigest(p.inputDigest) ||
      !['test', 'live'].includes(p.mode) || typeof p.email !== 'string' || p.email !== p.email.trim().toLowerCase() ||
      p.email.length < 3 || p.email.length > 320 || !p.email.includes('@') ||
      !(p.expectedCustomerId === null || validRef(p.expectedCustomerId, 'cus')) ||
      !(p.expectedSubscriptionId === null || validRef(p.expectedSubscriptionId, 'sub')) ||
      !['banner', 'seo', 'kantan'].includes(p.serviceId) ||
      (p.identity.kind === 'cancel' ? !['period_end', 'immediate'].includes(p.cancelMode as string) : p.cancelMode !== null) ||
      !Array.isArray(p.targets) || p.targets.length < 1 || p.targets.length > 128 || !p.targets.every(validTarget) ||
      p.targets.some((t, i) => i > 0 && p.targets[i - 1]!.id >= t.id) ||
      p.identity.kind === 'resume' && p.targets.length !== 1) return invalid()
  const { version: _v, source: _s, targetHash: _h, inputDigest: _d, ...payload } = p
  if (digest(planPayload(payload)) !== p.inputDigest) return invalid()
  return p
}

export function subscriptionResources(plan: SubscriptionPlan): LifecycleResource[] {
  return plan.targets.map(target => ({
    type: plan.identity.kind === 'resume' ? 'subscription_resume' : plan.cancelMode === 'immediate' ? 'subscription_cancel' : 'subscription_schedule_cancel',
    mode: plan.mode, resourceId: target.id, inputDigest: digest([plan.inputDigest, target]),
  }))
}

export function subscriptionActionKeys(plan: SubscriptionPlan): string[] {
  return subscriptionResources(plan).map(lifecycleActionKey)
}
