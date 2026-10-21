'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type AdminIntent = 'period_end_cancel' | 'immediate_cancel' | 'resume'
export type AdminHandle = { version: 1; actorId: string; targetUserId: string; operationId: string; intent: AdminIntent }
export type AdminOperationView = { source: 'admin'; actorId: string; targetUserId: string; operationId: string;
  intent: AdminIntent; phase: 'missing' | 'reserved' | 'executing' | 'completed' | 'aborted'; reason: string | null;
  canAbort: boolean; canContinue: boolean; actionPhase: string | null; result: 'confirmed' | null }

const key = (actorId: string) => `doya:admin-subscription:v1:${actorId}`
const storageError = '保存された課金操作を安全に確認できません。最新のブラウザで再確認してください'
async function withHandleLock<T>(actorId: string, work: () => T | Promise<T>): Promise<T> {
  if (!window.navigator.locks?.request) throw new Error(storageError)
  return window.navigator.locks.request(key(actorId), { mode: 'exclusive' }, work)
}
const validId = (value: unknown) => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value)
const validUuid = (value: unknown) => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value)
const validIntent = (value: unknown): value is AdminIntent => ['period_end_cancel', 'immediate_cancel', 'resume'].includes(String(value))
function readHandle(actorId: string): AdminHandle | null {
  const raw = localStorage.getItem(key(actorId))
  if (!raw) return null
  const value: unknown = JSON.parse(raw)
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).sort().join(',') !== ['version', 'actorId', 'targetUserId', 'operationId', 'intent'].sort().join(','))
    throw new Error('保存された課金操作を確認できません')
  const v = value as AdminHandle
  if (v.version !== 1 || v.actorId !== actorId || !validId(v.targetUserId) || !validUuid(v.operationId) || !validIntent(v.intent))
    throw new Error('保存された課金操作を確認できません')
  return v
}
function validView(value: unknown, h: AdminHandle): value is AdminOperationView {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const v = value as AdminOperationView
  return v.source === 'admin' && v.actorId === h.actorId && v.targetUserId === h.targetUserId &&
    v.operationId === h.operationId && v.intent === h.intent &&
    ['missing', 'reserved', 'executing', 'completed', 'aborted'].includes(v.phase) &&
    typeof v.canAbort === 'boolean' && typeof v.canContinue === 'boolean'
}

/** One durable handle per actual admin. Unknown transport outcome never starts a new operation. */
export function useAdminSubscriptionOperation() {
  const [actorId, setActorId] = useState<string | null>(null)
  const [handle, setHandle] = useState<AdminHandle | null>(null)
  const [view, setView] = useState<AdminOperationView | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const active = useRef(true)
  const lease = useRef(0)
  const actorRef = useRef<string | null>(null)
  const handleRef = useRef<AdminHandle | null>(null)
  const busyRef = useRef(false)
  const storageBlocked = useRef(false)
  const setHandleBoth = useCallback((next: AdminHandle | null) => { handleRef.current = next; setHandle(next) }, [])

  const refreshPrincipal = useCallback(async () => {
    const ticket = ++lease.current
    actorRef.current = null; setActorId(null); setHandleBoth(null); setView(null)
    busyRef.current = false; setBusy(false)
    storageBlocked.current = true
    try {
      const response = await fetch('/api/admin/auth/session', { credentials: 'include', cache: 'no-store' })
      const body = await response.json()
      const id = response.ok && validId(body?.adminUser?.id) ? body.adminUser.id as string : null
      if (!active.current || ticket !== lease.current) return
      actorRef.current = id; setActorId(id)
      if (!id) { setHandleBoth(null); setError('管理者の認証状態を確認してください'); return }
      const saved = readHandle(id)
      setHandleBoth(saved); storageBlocked.current = false; setError(null)
    } catch {
      if (!active.current || ticket !== lease.current) return
      setHandleBoth(null); setError('管理者または保存操作を確認できません')
    }
  }, [setHandleBoth])

  useEffect(() => {
    active.current = true
    const leaseRef = lease
    void refreshPrincipal()
    const hide = () => { lease.current++; busyRef.current = false; setBusy(false); setView(null) }
    const show = (event: PageTransitionEvent) => { if (event.persisted) void refreshPrincipal() }
    const focus = () => { void refreshPrincipal() }
    const visible = () => { if (document.visibilityState === 'visible') void refreshPrincipal() }
    window.addEventListener('pagehide', hide)
    window.addEventListener('pageshow', show)
    window.addEventListener('focus', focus)
    document.addEventListener('visibilitychange', visible)
    return () => { active.current = false; leaseRef.current++; window.removeEventListener('pagehide', hide); window.removeEventListener('pageshow', show); window.removeEventListener('focus', focus); document.removeEventListener('visibilitychange', visible) }
  }, [refreshPrincipal])

  const request = useCallback(async (operation: 'start' | 'status' | 'continue' | 'reconcile' | 'abort', h: AdminHandle) => {
    if (busyRef.current || storageBlocked.current || actorRef.current !== h.actorId || handleRef.current?.operationId !== h.operationId) {
      setError('現在の管理者と保存操作を確認してください')
      return null
    }
    try {
      if (readHandle(h.actorId)?.operationId !== h.operationId) {
        setHandleBoth(readHandle(h.actorId)); setView(null)
        setError('別の画面で保存操作が変更されました。保存状態を再確認してください')
        return null
      }
    } catch { setError(storageError); return null }
    busyRef.current = true; setBusy(true); setError(null)
    const ticket = ++lease.current
    const current = () => active.current && ticket === lease.current && actorRef.current === h.actorId &&
      handleRef.current?.operationId === h.operationId
    try {
      const response = await fetch('/api/admin/stripe', { method: 'POST', credentials: 'include', cache: 'no-store',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: operation,
          operationId: h.operationId, expectedAdminId: h.actorId, targetUserId: h.targetUserId, intent: h.intent }) })
      const body: unknown = await response.json()
      if (!current()) return null
      if (response.status === 401 || response.status === 403) {
        lease.current++; actorRef.current = null; setActorId(null); setHandleBoth(null); setView(null)
        storageBlocked.current = true; busyRef.current = false; setBusy(false)
        setError('管理者の認証状態を再確認してください。保存された操作は保持されています')
        return null
      }
      if (!response.ok || !validView(body, h)) throw new Error('操作結果を確定できません。保存された操作の状態を確認してください')
      setView(body)
      return body
    } catch (cause) {
      if (current()) setError(cause instanceof Error ? cause.message : '操作結果を確認できません')
      return null
    } finally {
      if (current()) { busyRef.current = false; setBusy(false) }
    }
  }, [setHandleBoth])

  const start = useCallback(async (targetUserId: string, intent: AdminIntent) => {
    const actor = actorRef.current
    if (!actor || storageBlocked.current || !validId(targetUserId)) { setError('現在の管理者と対象ユーザーを確認してください'); return null }
    if (handleRef.current) {
      setError('保存中の課金操作を先に確認してください')
      return null
    }
    const ticket = lease.current
    const h: AdminHandle = { version: 1, actorId: actor, targetUserId, operationId: crypto.randomUUID(), intent }
    try {
      const saved = await withHandleLock(actor, () => {
        const existing = readHandle(actor)
        if (existing) return existing
        if (!active.current || lease.current !== ticket || actorRef.current !== actor ||
            storageBlocked.current || handleRef.current) throw new Error(storageError)
        localStorage.setItem(key(actor), JSON.stringify(h))
        if (readHandle(actor)?.operationId !== h.operationId) throw new Error(storageError)
        return h
      })
      if (saved.operationId !== h.operationId) {
        if (active.current && actorRef.current === actor && lease.current === ticket) {
          setHandleBoth(saved); setView(null); setError('別の画面の保存操作を先に確認してください')
        }
        return null
      }
    } catch {
      if (active.current && actorRef.current === actor && lease.current === ticket)
        setError('操作番号を安全に保存できなかったため送信していません')
      return null
    }
    if (!active.current || actorRef.current !== actor || lease.current !== ticket) return null
    setHandleBoth(h)
    return request('start', h)
  }, [request, setHandleBoth])

  const act = useCallback(async (operation: 'status' | 'continue' | 'reconcile' | 'abort') => {
    const h = handleRef.current
    if (!h) { setError('保存操作がありません'); return null }
    if (operation === 'continue' && view?.canContinue !== true) return null
    if (operation === 'abort' && view?.canAbort !== true) return null
    return request(operation, h)
  }, [request, view])

  const clearTerminal = useCallback(async () => {
    const h = handleRef.current
    if (!h || !view || view.operationId !== h.operationId || !['completed', 'aborted'].includes(view.phase)) return false
    const ticket = lease.current
    try {
      const removed = await withHandleLock(h.actorId, () => {
        const saved = readHandle(h.actorId)
        if (!saved || saved.operationId !== h.operationId) return false
        if (!active.current || lease.current !== ticket || actorRef.current !== h.actorId ||
            handleRef.current?.operationId !== h.operationId) return false
        localStorage.removeItem(key(h.actorId))
        return readHandle(h.actorId) === null
      })
      if (!removed) {
        if (active.current && actorRef.current === h.actorId && lease.current === ticket) {
          setHandleBoth(readHandle(h.actorId)); setView(null)
          setError('別の画面で保存操作が変更されました。保存状態を再確認してください')
        }
        return false
      }
    } catch {
      if (active.current && actorRef.current === h.actorId && lease.current === ticket)
        setError('保存操作を安全に消去できません')
      return false
    }
    if (!active.current || actorRef.current !== h.actorId || lease.current !== ticket) return false
    setHandleBoth(null); setView(null); setError(null)
    return true
  }, [setHandleBoth, view])

  return { actorId, handle, view, busy, error, start, act, clearTerminal, refreshPrincipal }
}
