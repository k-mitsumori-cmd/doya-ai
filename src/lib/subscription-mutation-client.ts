import { BillingResponseError } from './billing-response-client'

export type SubscriptionOperation = 'cancel' | 'resume'

export type SubscriptionOperationState = {
  actorId: string; operationId: string; kind: SubscriptionOperation
  phase: 'missing' | 'reserved' | 'executing' | 'aborted' | 'completed'
  reason: null | 'EXTERNAL_UNKNOWN' | 'NEEDS_REVIEW'
  canAbort: boolean; canContinue: boolean
  actions: Array<{ subscriptionId: string; phase: 'planned' | 'dispatched' | 'confirmed'; status: string | null }>
}
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/
export function parseSubscriptionOperation(data: Record<string, unknown>, actorId: string, operationId: string,
  kind: SubscriptionOperation): SubscriptionOperationState {
  if (Object.keys(data).sort().join(',') !== 'actions,actorId,canAbort,canContinue,kind,operationId,phase,reason' ||
      data.actorId !== actorId || data.operationId !== operationId || !uuid.test(operationId) ||
      data.kind !== kind || !['missing', 'reserved', 'executing', 'aborted', 'completed'].includes(String(data.phase)) ||
      !(data.reason === null || data.reason === 'EXTERNAL_UNKNOWN' || data.reason === 'NEEDS_REVIEW') ||
      typeof data.canAbort !== 'boolean' || typeof data.canContinue !== 'boolean' || !Array.isArray(data.actions) ||
      data.actions.length > 128) throw new BillingResponseError()
  const actions: SubscriptionOperationState['actions'] = []
  for (const value of data.actions) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BillingResponseError()
    const action = value as Record<string, unknown>
    if (Object.keys(action).sort().join(',') !== 'phase,status,subscriptionId' ||
        typeof action.subscriptionId !== 'string' || !/^sub_[A-Za-z0-9_]{1,150}$/.test(action.subscriptionId) ||
        !['planned', 'dispatched', 'confirmed'].includes(String(action.phase)) ||
        !(action.status === null || typeof action.status === 'string') ||
        (action.phase === 'confirmed') !== (typeof action.status === 'string') ||
        action.phase === 'confirmed' && !(kind === 'resume' ? action.status === 'resumed' : ['scheduled_cancel', 'canceled', 'incomplete_expired'].includes(String(action.status)))) throw new BillingResponseError()
    actions.push(action as SubscriptionOperationState['actions'][number])
  }
  if (new Set(actions.map(a => a.subscriptionId)).size !== actions.length ||
      ['missing', 'aborted'].includes(String(data.phase)) && actions.length > 0 ||
      data.phase === 'reserved' && actions.some(a => a.phase !== 'planned') ||
      data.phase === 'completed' && (actions.length === 0 || actions.some(a => a.phase !== 'confirmed')) ||
      data.canAbort === true && !['missing', 'reserved'].includes(String(data.phase)) ||
      data.canContinue === true && !['reserved', 'executing'].includes(String(data.phase))) throw new BillingResponseError()
  return data as SubscriptionOperationState
}
