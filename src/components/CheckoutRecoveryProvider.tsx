'use client'

import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { useSession } from 'next-auth/react'
import { readBillingResponse } from '@/lib/billing-response-client'
import { CheckoutRecoveryClient, checkoutReturnPath, checkoutStoredIntent, type CheckoutSnapshot } from '@/lib/checkout-recovery-client'

const Context = createContext<CheckoutRecoveryClient | null>(null)
const unavailable: CheckoutSnapshot = { phase: 'blocked', handle: null, busy: false, dispatched: false, message: null }
const noSubscription = () => () => {}
const unavailableSnapshot = () => unavailable

/** Shared User lane survives individual button remounts without remounting SessionProvider children. */
export function CheckoutRecoveryProvider({ children }: { children: ReactNode }) {
  const { data, status } = useSession()
  const actor = status === 'authenticated' ? (data?.user as { id?: string } | undefined)?.id || null : null
  const [pageEpoch, setPageEpoch] = useState(0)
  const actorContext = actor ? `${status}:${actor}:${pageEpoch}` : null
  const manager = useMemo(() => actor && actorContext ? new CheckoutRecoveryClient(actor, () => window.sessionStorage,
    (body, headers, signal) => readBillingResponse('/api/stripe/checkout', { method: 'POST', headers, body: JSON.stringify(body) }, signal),
    () => crypto.randomUUID()) : null, [actor, actorContext])
  const pendingDispose = useRef<{ value: CheckoutRecoveryClient | null; timer: ReturnType<typeof setTimeout> } | null>(null)
  useLayoutEffect(() => {
    const pending = pendingDispose.current
    if (pending) {
      clearTimeout(pending.timer)
      if (pending.value !== manager) pending.value?.dispose()
      pendingDispose.current = null
    }
    return () => {
      // React StrictMode replays setup/cleanup with the same instance. A real unmount
      // or a changed principal/epoch must still retire the old manager.
      const timer = setTimeout(() => {
        manager?.dispose()
        if (pendingDispose.current?.timer === timer) pendingDispose.current = null
      }, 0)
      pendingDispose.current = { value: manager, timer }
    }
  }, [manager])
  useEffect(() => {
    const hide = () => manager?.dispose()
    const show = () => setPageEpoch(value => value + 1)
    window.addEventListener('pagehide', hide); window.addEventListener('pageshow', show)
    return () => { window.removeEventListener('pagehide', hide); window.removeEventListener('pageshow', show) }
  }, [manager])
  return <Context.Provider value={manager}>{children}<CheckoutRecoveryNotice /></Context.Provider>
}

export function useCheckoutRecovery() {
  const manager = useContext(Context)
  const snapshot = useSyncExternalStore(manager?.subscribe || noSubscription, manager?.snapshot || unavailableSnapshot, unavailableSnapshot)
  return { manager, snapshot }
}

function CheckoutRecoveryNotice() {
  const { manager, snapshot } = useCheckoutRecovery()
  const [statusMessage, setStatusMessage] = useState('')
  useEffect(() => { manager?.inspectStored() }, [manager])
  const handle = snapshot.handle
  const noticeLife = useRef<{ manager: CheckoutRecoveryClient | null; operationId: string | null; active: boolean } | null>(null)
  const attempt = useRef(0)
  useLayoutEffect(() => {
    const life = { manager, operationId: handle?.operationId || null, active: true }
    noticeLife.current = life
    const retire = () => { life.active = false; attempt.current++ }
    window.addEventListener('pagehide', retire)
    return () => {
      retire(); window.removeEventListener('pagehide', retire)
      if (noticeLife.current === life) noticeLife.current = null
    }
  }, [manager, handle?.operationId])
  useEffect(() => { setStatusMessage('') }, [manager, handle?.operationId])
  if (!manager || !handle || snapshot.phase === 'aborted') return null
  const path = checkoutReturnPath(handle)
  const storedIntent = () => {
    let selectedOrganization: string | null = null
    try { selectedOrganization = window.sessionStorage.getItem(`hr-selected-organization:v1:${manager.actorId}`) }
    catch { return null }
    return checkoutStoredIntent(handle, manager.actorId, window.location.pathname, selectedOrganization)
  }
  const checkStatus = async () => {
    const life = noticeLife.current
    if (!life?.active || life.manager !== manager || life.operationId !== handle.operationId) return
    const request = ++attempt.current
    setStatusMessage('')
    const intent = storedIntent()
    if (!intent) { setStatusMessage('元のサービス・組織を選択してから確認してください。'); return }
    const current = () => life.active && noticeLife.current === life && attempt.current === request &&
      storedIntent()?.returnTo === intent.returnTo &&
      manager.snapshot().handle?.operationId === handle.operationId && manager.snapshot().handle?.scopeKey === handle.scopeKey
    await manager.status(intent, current)
    if (current()) setStatusMessage(manager.snapshot().phase === 'unknown' ? '申込結果を確認できませんでした。' :
      '保存済み申込の状態を確認しました。決済や契約の完了を意味しません。')
  }
  return <aside role="status" className="fixed bottom-4 right-4 z-50 max-w-xs rounded-xl border border-amber-300 bg-white p-3 text-xs font-medium leading-relaxed text-slate-800 shadow-lg">
    <p>このタブに購入申込の記録があります。元のサービス・組織で状態をご確認ください。</p>
    <button type="button" onClick={() => void checkStatus()} disabled={snapshot.busy} className="mt-2 rounded border border-slate-400 px-2 py-1 font-bold disabled:opacity-50">保存済み申込の状態を確認</button>
    {path && <a href={path} className="ml-2 inline-block font-bold text-blue-700 underline">元の申込画面へ戻る</a>}
    {statusMessage && <p className="mt-2">{statusMessage}</p>}
  </aside>
}
