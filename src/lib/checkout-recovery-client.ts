import { billingRedirectUrl } from './billing-response-client'

export type CheckoutIntent = {
  planId: string
  billingPeriod: 'monthly' | 'yearly'
  serviceId: string
  returnTo: string | null
  organization: { actor: string; organizationId: string } | null
}
type Handle = { version: 1; actorId: string; operationId: string; scopeKey: string; previousOperationId: string | null }
export type CheckoutPhase = 'idle' | 'checking' | 'missing' | 'reserved' | 'executing' | 'completed' | 'provider_complete' | 'aborted' | 'expired' | 'unknown' | 'blocked'
export type CheckoutSnapshot = { phase: CheckoutPhase; handle: Handle | null; busy: boolean; dispatched: boolean; message: string | null }
export type CheckoutResponse = { ok: boolean; status: number; data: Record<string, unknown> }
export type CheckoutOutcome = { kind: 'ready'; url: string } | { kind: 'plan_change' | 'subscribed' | 'provider_complete' | 'none' }
type Post = (body: Record<string, unknown>, headers: Record<string, string>, signal: AbortSignal) => Promise<CheckoutResponse>
type StoragePort = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/
const unknownMessage = '先ほどのお申し込みの結果を確認中です。新しいお申し込みを繰り返さないでください。'
const storageMessage = '申込情報をこのタブに保存できませんでした。ブラウザの保存設定をご確認ください。'
const contextMessage = 'ログインまたは選択中のサービス・組織が変わりました。現在の画面で状態を確認してください。'
const key = (actorId: string) => `doya-checkout-handle-v1:${encodeURIComponent(actorId)}`
const valid = (value: unknown): value is Handle => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const h = value as Record<string, unknown>
  return Object.keys(h).sort().join(',') === 'actorId,operationId,previousOperationId,scopeKey,version' && h.version === 1 &&
    typeof h.actorId === 'string' && h.actorId.length > 0 && uuid.test(String(h.operationId)) &&
    typeof h.scopeKey === 'string' && h.scopeKey.length > 0 && h.scopeKey.length <= 1024 &&
    (h.previousOperationId === null || uuid.test(String(h.previousOperationId)))
}
export const checkoutScopeKey = (intent: CheckoutIntent) => JSON.stringify([
  intent.planId, intent.billingPeriod, intent.serviceId, intent.returnTo,
  intent.organization?.actor ?? null, intent.organization?.organizationId ?? null,
])
/** A stored handle is only a navigation hint here; server authorization still owns recovery. */
export function checkoutReturnPath(handle: CheckoutSnapshot['handle']): string | null {
  if (!handle) return null
  try {
    const scope: unknown = JSON.parse(handle.scopeKey)
    if (!Array.isArray(scope) || scope.length !== 6) return null
    const path = scope[3]
    return typeof path === 'string' && path.startsWith('/') && !path.startsWith('//') && path.length <= 500 &&
      !/[?#\\\u0000-\u001f\u007f]/.test(path) ? path : null
  } catch { return null }
}

/** Restores only the exact scope needed for an explicit status read. */
export function checkoutStoredIntent(handle: CheckoutSnapshot['handle'], actorId: string, currentPath: string,
  selectedOrganization: string | null): CheckoutIntent | null {
  if (!handle || handle.actorId !== actorId) return null
  try {
    const values: unknown = JSON.parse(handle.scopeKey)
    if (!Array.isArray(values) || values.length !== 6) return null
    const [planId, billingPeriod, serviceId, returnTo, organizationActor, organizationId] = values
    if (typeof planId !== 'string' || !/^[a-z0-9-]{1,100}$/.test(planId) ||
      (billingPeriod !== 'monthly' && billingPeriod !== 'yearly') ||
      typeof serviceId !== 'string' || !/^[a-z0-9-]{1,50}$/.test(serviceId) ||
      (returnTo !== null && (typeof returnTo !== 'string' || checkoutReturnPath(handle) !== returnTo))) return null
    let organization: CheckoutIntent['organization'] = null
    if (organizationActor !== null || organizationId !== null) {
      if (serviceId !== 'hr' || organizationActor !== actorId || typeof organizationId !== 'string' ||
        !organizationId || organizationId.length > 512 || /[\s\u0000-\u001f\u007f]/.test(organizationId) ||
        selectedOrganization !== organizationId || !/^\/hr(?:\/|$)/.test(currentPath)) return null
      organization = { actor: actorId, organizationId }
    }
    const intent: CheckoutIntent = { planId, billingPeriod, serviceId, returnTo, organization }
    return checkoutScopeKey(intent) === handle.scopeKey ? intent : null
  } catch { return null }
}

/** One browser-tab User lane. It does not infer non-execution from a timeout or abort. */
export class CheckoutRecoveryClient {
  private snapshotValue: CheckoutSnapshot = { phase: 'checking', handle: null, busy: false, dispatched: false, message: null }
  private listeners = new Set<() => void>()
  private loaded = false
  private alive = true
  private pending: AbortController | null = null
  private pendingDone: Promise<void> | null = null
  constructor(readonly actorId: string, private storage: () => StoragePort, private post: Post, private newUuid: () => string) {}
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  snapshot = () => this.snapshotValue
  private publish(update: Partial<CheckoutSnapshot>) { this.snapshotValue = { ...this.snapshotValue, ...update }; for (const listener of this.listeners) listener() }
  dispose() { this.alive = false; this.pending?.abort(); this.pending = null; this.listeners.clear() }
  private current(signal?: AbortSignal, lease: () => boolean = () => true) { return this.alive && !signal?.aborted && lease() }
  private readHandle(): Handle | null {
    const raw = this.storage().getItem(key(this.actorId))
    if (raw === null) return null
    const value: unknown = JSON.parse(raw)
    if (!valid(value) || value.actorId !== this.actorId) throw Error(storageMessage)
    return value
  }
  private save(handle: Handle) { this.storage().setItem(key(this.actorId), JSON.stringify(handle)); this.publish({ handle }) }
  inspectStored() {
    if (this.loaded) return
    this.loaded = true
    try { const handle = this.readHandle(); this.publish({ handle, phase: handle ? 'checking' : 'idle' }) }
    catch { this.publish({ phase: 'blocked', message: storageMessage }) }
  }
  private body(action: 'status' | 'ready' | 'resume' | 'abort', handle: Handle) { return { action, operationId: handle.operationId, expectedActorId: this.actorId } }
  private headers(intent: CheckoutIntent): Record<string, string> {
    const org = intent.organization
    return { 'Content-Type': 'application/json', ...(org ? { 'X-HR-Selected-Actor': org.actor, 'X-HR-Selected-Organization': org.organizationId, 'X-HR-Organization-Id': org.organizationId } : {}) }
  }
  private async send(body: Record<string, unknown>, intent: CheckoutIntent, signal: AbortSignal) {
    return this.post(body, this.headers(intent), signal)
  }
  private verify(data: Record<string, unknown>, handle: Handle, allowCanonical = false, lease: () => boolean = () => true): string {
    if (data.code !== undefined || data.error !== undefined || data.actorId !== this.actorId ||
      !uuid.test(String(data.operationId)) || !this.current(undefined, lease)) throw Error(contextMessage)
    if (!allowCanonical && data.operationId !== handle.operationId) throw Error(contextMessage)
    return data.operationId as string
  }
  private async task<T>(work: (signal: AbortSignal) => Promise<T>, lease: () => boolean = () => true): Promise<T | null> {
    if (!this.current(undefined, lease) || this.pending) return null
    const controller = new AbortController(); this.pending = controller
    let releasePending = () => {}
    const done = new Promise<void>(resolve => { releasePending = resolve })
    this.pendingDone = done
    this.publish({ busy: true })
    try { return await work(controller.signal) }
    catch { if (this.current(controller.signal, lease)) this.publish({ phase: 'unknown', message: unknownMessage }); return null }
    finally { if (this.pending === controller) { this.pending = null; this.pendingDone = null; if (this.alive) this.publish({ busy: false }); controller.abort() }; releasePending() }
  }
  /** Only a status observation is automatic after reload or a new mount. */
  async observe(intent: CheckoutIntent, lease: () => boolean = () => true) {
    this.inspectStored()
    if (this.snapshotValue.phase === 'blocked') return
    const handle = this.snapshotValue.handle
    if (!handle || handle.scopeKey !== checkoutScopeKey(intent) || this.snapshotValue.phase !== 'checking') return
    if (this.pendingDone) await this.pendingDone
    if (!this.current(undefined, lease) || this.snapshotValue.phase !== 'checking') return
    await this.status(intent, lease)
  }
  async status(intent: CheckoutIntent, lease: () => boolean = () => true) {
    const handle = this.snapshotValue.handle
    if (!handle || handle.scopeKey !== checkoutScopeKey(intent)) return
    await this.task(async signal => {
      const response = await this.send(this.body('status', handle), intent, signal)
      if (!this.current(signal, lease)) return
      if (!response.ok) { this.publish({ phase: 'unknown', message: unknownMessage }); return }
      this.verify(response.data, handle, false, lease)
      const phase = response.data.phase
      if (!['missing', 'reserved', 'executing', 'completed', 'aborted'].includes(String(phase))) throw Error(contextMessage)
      if (typeof response.data.dispatched !== 'boolean') throw Error(contextMessage)
      const dispatched = response.data.dispatched
      this.publish({ phase: dispatched && phase !== 'completed' ? 'unknown' : phase as CheckoutPhase, dispatched, message: null })
    }, lease)
  }
  private async ready(handle: Handle, intent: CheckoutIntent, signal: AbortSignal, lease: () => boolean): Promise<CheckoutOutcome> {
    const response = await this.send(this.body('ready', handle), intent, signal)
    if (!this.current(signal, lease)) return { kind: 'none' }
    if (!response.ok) {
      if (response.status === 409 && response.data.code === 'CHECKOUT_EXPIRED') this.publish({ phase: 'expired', message: '決済画面の期限が切れました。新しいお申し込みは明示的に開始できます。' })
      else if (response.status === 409 && response.data.code === 'CHECKOUT_ALREADY_COMPLETED') {
        this.publish({ phase: 'provider_complete', message: '決済画面は完了しています。契約の反映状況を確認してください。' })
        return { kind: 'provider_complete' }
      }
      else this.publish({ phase: 'unknown', message: unknownMessage })
      return { kind: 'none' }
    }
    this.verify(response.data, handle, false, lease)
    const url = billingRedirectUrl(response.data.url)
    if (!url || typeof response.data.sessionId !== 'string' || !response.data.sessionId.startsWith('cs_')) throw Error(contextMessage)
    this.publish({ phase: 'completed', message: null })
    return { kind: 'ready', url }
  }
  private async startWith(intent: CheckoutIntent, previousOperationId: string | null, lease: () => boolean): Promise<CheckoutOutcome | null> {
    return this.task(async signal => {
      const operationId = this.newUuid()
      if (!uuid.test(operationId)) throw Error(contextMessage)
      const handle: Handle = { version: 1, actorId: this.actorId, operationId, scopeKey: checkoutScopeKey(intent), previousOperationId }
      try { this.save(handle) } catch { this.publish({ phase: 'blocked', message: storageMessage }); return { kind: 'none' } }
      this.publish({ phase: 'checking', message: null })
      const action = previousOperationId ? 'start_after_terminal' : 'start'
      const response = await this.send({ action, operationId, expectedActorId: this.actorId,
        ...(previousOperationId ? { previousOperationId } : {}), planId: intent.planId, billingPeriod: intent.billingPeriod,
        serviceId: intent.serviceId, returnTo: intent.returnTo }, intent, signal)
      if (!this.current(signal, lease)) return { kind: 'none' }
      if (!response.ok) {
        if (response.status === 409 && response.data.code === 'PLAN_CHANGE_REQUIRED') {
          this.publish({ phase: 'unknown', message: unknownMessage })
          return { kind: 'plan_change' }
        }
        if (response.status === 409 && response.data.code === 'ALREADY_SUBSCRIBED') {
          this.publish({ phase: 'unknown', message: unknownMessage })
          return { kind: 'subscribed' }
        }
        this.publish({ phase: 'unknown', message: unknownMessage }); return { kind: 'none' }
      }
      const canonical = this.verify(response.data, handle, true, lease)
      if (canonical !== operationId) {
        try { this.save({ ...handle, operationId: canonical }) } catch { this.publish({ phase: 'blocked', message: storageMessage }); return { kind: 'none' } }
      }
      const currentHandle = this.snapshotValue.handle!
      if (typeof response.data.url !== 'string') { this.publish({ phase: 'unknown', message: unknownMessage }); return { kind: 'none' } }
      return this.ready(currentHandle, intent, signal, lease)
    }, lease)
  }
  async start(intent: CheckoutIntent, lease: () => boolean = () => true) {
    if (!this.loaded || this.snapshotValue.handle || this.snapshotValue.phase !== 'idle') return null
    return this.startWith(intent, null, lease)
  }
  async resume(intent: CheckoutIntent, lease: () => boolean = () => true): Promise<CheckoutOutcome | null> {
    const handle = this.snapshotValue.handle
    if (!handle || handle.scopeKey !== checkoutScopeKey(intent) || this.snapshotValue.phase !== 'reserved' || this.snapshotValue.dispatched) return null
    return this.task(async signal => {
      const response = await this.send(this.body('resume', handle), intent, signal)
      if (!this.current(signal, lease)) return { kind: 'none' }
      if (!response.ok) { this.publish({ phase: 'unknown', message: unknownMessage }); return { kind: 'none' } }
      this.verify(response.data, handle, false, lease)
      if (typeof response.data.url !== 'string') { this.publish({ phase: 'unknown', message: unknownMessage }); return { kind: 'none' } }
      return this.ready(handle, intent, signal, lease)
    }, lease)
  }
  async readyAgain(intent: CheckoutIntent, lease: () => boolean = () => true): Promise<CheckoutOutcome | null> {
    const handle = this.snapshotValue.handle
    if (!handle || handle.scopeKey !== checkoutScopeKey(intent) || this.snapshotValue.phase !== 'completed') return null
    return this.task(signal => this.ready(handle, intent, signal, lease), lease)
  }
  async abortMissing(intent: CheckoutIntent, lease: () => boolean = () => true) {
    const handle = this.snapshotValue.handle
    if (!handle || handle.scopeKey !== checkoutScopeKey(intent) || this.snapshotValue.phase !== 'missing') return
    await this.task(async signal => {
      const response = await this.send(this.body('abort', handle), intent, signal)
      if (!this.current(signal, lease)) return
      if (!response.ok) throw Error(unknownMessage)
      this.verify(response.data, handle, false, lease)
      if (response.data.phase !== 'aborted') throw Error(unknownMessage)
      this.publish({ phase: 'aborted', message: null })
    }, lease)
  }
  async newAfterTerminal(intent: CheckoutIntent, lease: () => boolean = () => true): Promise<CheckoutOutcome | null> {
    const handle = this.snapshotValue.handle
    if (!handle || handle.actorId !== this.actorId || !['aborted', 'expired'].includes(this.snapshotValue.phase) ||
      this.snapshotValue.phase === 'expired' && handle.scopeKey !== checkoutScopeKey(intent)) return null
    // An aborted successor is tombstoned itself; do not reuse an older expired
    // operation as its predecessor for another start_after_terminal request.
    const previous = this.snapshotValue.phase === 'expired' ? handle.operationId : null
    return this.startWith(intent, previous, lease)
  }
}
