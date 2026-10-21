'use client'

import { useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { readBillingResponse } from '@/lib/billing-response-client'
import { parseSubscriptionOperation, type SubscriptionOperation, type SubscriptionOperationState } from '@/lib/subscription-mutation-client'
import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus'

const UNKNOWN = '契約の変更結果を確認できませんでした。保存済みの操作で状態をご確認ください。'
const PARTIAL = '一部の契約を解約できませんでした。解約は完了しておらず、課金が続く可能性があります。保存済みの操作で状態をご確認ください。'
const STORAGE = '契約操作を保存できませんでした。ブラウザの保存設定をご確認ください。'
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/
type Handle = { version: 1; actorId: string; operationId: string; kind: SubscriptionOperation; serviceId: 'banner' | 'seo'; phase: SubscriptionOperationState['phase'] | 'checking' }
const keyFor = (actorId: string) => `doya-subscription-operation-v1:${encodeURIComponent(actorId)}`
const validHandle = (v: unknown, actorId: string): v is Handle => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false
  const h = v as Record<string, unknown>
  return Object.keys(h).sort().join(',') === 'actorId,kind,operationId,phase,serviceId,version' &&
    h.version === 1 && h.actorId === actorId && uuid.test(String(h.operationId)) &&
    ['cancel', 'resume'].includes(String(h.kind)) && ['banner', 'seo'].includes(String(h.serviceId)) &&
    ['checking', 'missing', 'reserved', 'executing', 'aborted', 'completed'].includes(String(h.phase))
}

/** One durable account lane is shared by the plan and settings callers. */
export function useSubscriptionManagement(serviceId: 'banner' | 'seo') {
  const { data: session, status } = useSession()
  const user = session?.user as { id?: string } | undefined
  const actorId = typeof user?.id === 'string' ? user.id : ''
  const allowed = status === 'authenticated' && Boolean(actorId)
  const subscription = useSubscriptionStatus(serviceId)
  const scope = JSON.stringify([status, actorId, serviceId])
  const epoch = useRef({ scope, version: 0 })
  if (epoch.current.scope !== scope) epoch.current = { scope, version: epoch.current.version + 1 }
  const scopeKey = JSON.stringify([scope, epoch.current.version])
  const context = useRef(scopeKey)
  context.current = scopeKey
  const active = useRef<{ key: string; controller: AbortController } | null>(null)
  const [state, setState] = useState<{ key: string; busy: boolean; handle: Handle | null; result: SubscriptionOperationState | null; message: string } | null>(null)
  const visible = allowed && state?.key === scopeKey ? state : null
  const publish = (patch: Partial<NonNullable<typeof state>>) => {
    if (context.current !== scopeKey) return
    setState(previous => ({ key: scopeKey, busy: false, handle: null, result: null, message: '', ...(previous?.key === scopeKey ? previous : {}), ...patch }))
  }
  const read = (): Handle | null => {
    const raw = window.localStorage.getItem(keyFor(actorId))
    if (raw === null) return null
    const parsed: unknown = JSON.parse(raw)
    if (!validHandle(parsed, actorId)) throw Error(STORAGE)
    return parsed
  }
  const save = (handle: Handle) => { window.localStorage.setItem(keyFor(actorId), JSON.stringify(handle)); publish({ handle }) }
  const send = async (handle: Handle, action: 'status' | 'start' | 'continue' | 'abort' | 'reconcile', signal: AbortSignal) => {
    const body = action === 'start' ? { action, operationId: handle.operationId, expectedActorId: actorId, serviceId: handle.serviceId,
      ...(handle.kind === 'cancel' ? { mode: 'period_end' } : {}) } : { action, operationId: handle.operationId, expectedActorId: actorId }
    const response = await readBillingResponse(`/api/stripe/subscription/${handle.kind}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, signal)
    if (!response.ok) throw Error(handle.kind === 'cancel' && response.status === 502 && response.data.code === 'CANCELLATION_INCOMPLETE' ? PARTIAL : UNKNOWN)
    return parseSubscriptionOperation(response.data, actorId, handle.operationId, handle.kind)
  }
  const request = async (work: (signal: AbortSignal, current: () => boolean) => Promise<SubscriptionOperationState | null>) => {
    if (!allowed || context.current !== scopeKey || active.current) return null
    const controller = new AbortController()
    active.current = { key: scopeKey, controller }
    const current = () => context.current === scopeKey && active.current?.controller === controller && !controller.signal.aborted
    publish({ busy: true })
    try { const result = await work(controller.signal, current); return current() ? result : null }
    catch (error) { if (current()) publish({ message: error instanceof Error && error.message === PARTIAL ? PARTIAL : UNKNOWN }); return null }
    finally { if (active.current?.controller === controller) { active.current = null; controller.abort(); if (context.current === scopeKey) publish({ busy: false }) } }
  }
  const adopt = (handle: Handle, result: SubscriptionOperationState, current: () => boolean) => {
    if (!current()) return
    save({ ...handle, phase: result.phase })
    publish({ result, message: result.phase === 'completed' ? (result.kind === 'cancel' ? '統一プランの解約予約を受け付けました。停止日時を確認しています。' : '統一プランの解約予約を取り消しました。契約状態を確認しています。') :
      result.phase === 'aborted' ? '未実行の操作を終了しました。' : result.reason || result.actions.some(a => a.phase === 'dispatched') ?
        result.kind === 'cancel' && result.actions.some(a => a.phase === 'confirmed') ? PARTIAL : UNKNOWN :
      result.phase === 'reserved' ? '保存済みの操作があります。明示的に続行できます。' :
      result.phase === 'missing' ? '保存済みの操作は見つかりません。未実行と確認してから終了してください。' : '操作の状態を確認しました。' })
    if (result.phase === 'completed') { subscription.refresh(); window.dispatchEvent(new CustomEvent('doya:subscription-updated', { detail: { actor: actorId } })) }
  }
  const observe = async () => request(async (signal, current) => {
    let handle: Handle | null
    try { handle = read() } catch { if (current()) publish({ message: STORAGE }); return null }
    if (!handle) { if (current()) publish({ handle: null, result: null }); return null }
    if (current()) publish({ handle, message: '保存済みの契約操作を確認しています。' })
    const result = await send(handle, 'status', signal)
    adopt(handle, result, current)
    return result
  })
  useEffect(() => {
    if (!allowed) return
    let alive = true
    void Promise.resolve().then(() => { if (alive && context.current === scopeKey) void observe() })
    const changed = (event: StorageEvent) => { if (event.key === keyFor(actorId) && context.current === scopeKey) { active.current?.controller.abort(); active.current = null; void observe() } }
    const hidden = () => { active.current?.controller.abort(); active.current = null }
    const shown = (event: PageTransitionEvent) => { if (event.persisted && context.current === scopeKey) void observe() }
    window.addEventListener('storage', changed)
    window.addEventListener('pagehide', hidden)
    window.addEventListener('pageshow', shown)
    return () => { alive = false; window.removeEventListener('storage', changed); window.removeEventListener('pagehide', hidden); window.removeEventListener('pageshow', shown); hidden() }
  // Restore once per authenticated actor/scope, not on every subscription display refresh.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed, actorId, scopeKey])
  const actOnSaved = async (action: 'status' | 'continue' | 'abort' | 'reconcile') => request(async (signal, current) => {
    const handle = read()
    if (!handle) return null
    const result = await send(handle, action, signal)
    adopt(handle, result, current)
    return result
  })
  const run = async (kind: SubscriptionOperation) => {
    if (!allowed || !subscription.data?.hasSubscription || subscription.loading || subscription.error ||
        visible?.handle && !['completed', 'aborted'].includes(visible.handle.phase)) return null
    if (!navigator.locks) { publish({ message: STORAGE }); return null }
    return navigator.locks.request(keyFor(actorId), { mode: 'exclusive', ifAvailable: true }, async lock => {
      if (!lock) { publish({ message: '別の画面で契約操作中です。保存済みの状態をご確認ください。' }); return null }
      return request(async (signal, current) => {
        let old: Handle | null
        try { old = read() } catch { if (current()) publish({ message: STORAGE }); return null }
        if (old) {
          const previous = await send(old, 'status', signal)
          adopt(old, previous, current)
          if (!current() || !['completed', 'aborted'].includes(previous.phase)) return null
        }
        const operationId = crypto.randomUUID()
        if (!uuid.test(operationId)) throw Error(STORAGE)
        const handle: Handle = { version: 1, actorId, operationId, kind, serviceId, phase: 'checking' }
        try { save(handle) } catch { if (current()) publish({ message: STORAGE }); return null }
        const result = await send(handle, 'start', signal)
        adopt(handle, result, current)
        return current() && result.phase === 'completed' ? result : null
      })
    })
  }
  const unresolved = Boolean(visible?.handle && !['completed', 'aborted'].includes(visible.handle.phase))
  const busy = Boolean(visible?.busy) || subscription.loading
  const uncertain = unresolved || Boolean(visible?.message === UNKNOWN)
  return { run, recheck: () => void (visible?.handle ? actOnSaved('status') : subscription.refresh()),
    continueOperation: () => void actOnSaved('continue'), abortOperation: () => void actOnSaved('abort'),
    reconcileOperation: () => void actOnSaved('reconcile'),
    phase: visible?.result?.phase ?? visible?.handle?.phase ?? null, canContinue: visible?.result?.canContinue ?? false,
    canAbort: visible?.result?.canAbort ?? false, actions: visible?.result?.actions ?? [],
    busy, uncertain, scopeKey, disabled: !allowed || busy || unresolved || visible?.message === STORAGE || Boolean(subscription.error) || !subscription.data?.hasSubscription,
    data: busy || unresolved ? null : subscription.data, message: visible?.message || subscription.error || '' }
}
