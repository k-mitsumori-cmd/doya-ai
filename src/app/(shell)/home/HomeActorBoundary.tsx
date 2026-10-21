'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { useSession } from 'next-auth/react'
import { useEntryActorScope } from '@/lib/use-entry-organization'
import type { HomeSummary } from '@/lib/home/summary'
import { homeSnapshotEpoch } from './clock'

export interface HomeActorView {
  summary: HomeSummary
  loading: boolean
  error: string | null
  refresh: () => void
  current: () => boolean
  epoch: number
}

function summaryForActor(value: unknown, actor: string, requireValidTime = true): HomeSummary | null {
  if (!value || typeof value !== 'object') return null
  const data = value as Record<string, unknown>
  if (data.actorId !== actor || typeof data.generatedAt !== 'string' || (requireValidTime && homeSnapshotEpoch(data.generatedAt) === null)) return null
  if (!['user', 'contract', 'sources', 'sales', 'quotes', 'projects', 'attendance', 'people'].every(key => data[key] && typeof data[key] === 'object')) return null
  return Array.isArray(data.events) && Array.isArray(data.trend) ? value as HomeSummary : null
}

/** Homeだけの厳格な境界。共有SessionProvider/entry scopeの動作は変更しない。 */
export default function HomeActorBoundary({ initial, serverActorId, children }: {
  initial: HomeSummary
  serverActorId: string
  children: (view: HomeActorView) => ReactNode
}) {
  const scope = useEntryActorScope()
  const { update } = useSession()
  const [, render] = useState(0)
  const latestUpdate = useRef(update)
  latestUpdate.current = update
  const state = useRef({
    identity: '', sdkIdentity: '', epoch: 0, sequence: 0, live: true, actor: '', authenticated: false,
    initialUnused: true, propActor: serverActorId, waitForPropActor: '', lastInitial: initial,
    data: null as HomeSummary | null, loading: false, error: null as string | null, blocked: false,
    controller: null as AbortController | null, restoreCycle: 0, needsRestore: false, proofActor: '', checkingSession: false, sessionStarted: false,
  })
  const a = state.current
  const sdkIdentity = JSON.stringify([scope.actor, scope.status, scope.version])
  if (a.sdkIdentity && a.sdkIdentity !== sdkIdentity && a.needsRestore && a.sessionStarted) {
    // update自身のSDK遷移も外部のauth切替も、旧確認promiseの所有権を失効する。
    // 新しいSDK actorは表示を解禁せず、同actorをserver sessionで照合する新GETだけを許す。
    a.restoreCycle++
    a.checkingSession = false
    a.proofActor = scope.status === 'authenticated' ? scope.actor : ''
    a.error = null
  }
  a.sdkIdentity = sdkIdentity
  if (a.propActor !== serverActorId) {
    a.propActor = serverActorId
    a.waitForPropActor = serverActorId || 'invalid-server-actor'
  }
  if (scope.actor && a.waitForPropActor === scope.actor) a.waitForPropActor = ''
  const identity = JSON.stringify([scope.actor, scope.status, scope.version, serverActorId, initial.actorId, a.restoreCycle])
  if (a.identity !== identity) {
    a.identity = identity
    a.epoch++
    a.sequence++
    a.controller?.abort()
    a.data = null
    a.loading = false
    a.error = null
    a.blocked = false
  }
  a.actor = scope.actor
  a.authenticated = scope.status === 'authenticated' && Boolean(scope.actor.trim())
  if (!a.authenticated) a.initialUnused = false
  const ready = a.authenticated && !a.waitForPropActor && (!a.needsRestore || a.proofActor === a.actor)
  if (a.initialUnused && a.authenticated) {
    a.initialUnused = false
    if (ready && serverActorId === a.actor) a.data = summaryForActor(initial, a.actor, false)
  }
  if (a.lastInitial !== initial) {
    a.lastInitial = initial
    const next = ready && !a.needsRestore && serverActorId === a.actor ? summaryForActor(initial, a.actor) : null
    if (next && a.data && homeSnapshotEpoch(next.generatedAt)! > homeSnapshotEpoch(a.data.generatedAt)!) a.data = next
  }
  const epoch = a.epoch
  const actor = a.actor
  const current = useCallback(() => {
    const value = state.current
    return value.live && value.epoch === epoch && value.authenticated && value.actor === actor && !value.waitForPropActor && !value.blocked && (!value.needsRestore || value.proofActor === actor)
  }, [epoch, actor])
  const notify = useCallback(() => render(value => value + 1), [])
  const refresh = useCallback(async () => {
    const value = state.current
    if (!value.live || value.epoch !== epoch || !value.authenticated || value.actor !== actor || value.waitForPropActor || (value.needsRestore && value.proofActor !== actor)) return
    const sequence = ++value.sequence
    value.controller?.abort()
    const controller = new AbortController()
    value.controller = controller
    value.loading = true
    value.error = null
    value.blocked = false
    notify()
    const active = () => current() && state.current.sequence === sequence && !controller.signal.aborted
    let retainSnapshot = false
    try {
      const response = await fetch(`/api/home/summary?expectedActor=${encodeURIComponent(actor)}`, { cache: 'no-store', signal: controller.signal })
      if (!active()) return
      if (!response.ok) {
        retainSnapshot = response.status === 500
        throw new Error('Summary unavailable')
      }
      const body: unknown = await response.json()
      if (!active()) return
      const next = summaryForActor(body, actor)
      if (!next) throw new Error('Summary actor could not be confirmed')
      if (!value.data || homeSnapshotEpoch(next.generatedAt)! >= homeSnapshotEpoch(value.data.generatedAt)!) value.data = next
      value.needsRestore = false
      value.sessionStarted = false
      value.error = null
    } catch {
      if (!active()) return
      if (!retainSnapshot) {
        value.data = null
        value.blocked = true
      }
      value.error = retainSnapshot ? '最新の数字を取得できませんでした。表示は前回の取得時刻の内容です。' : 'ログイン状態と最新の数字を確認できませんでした。再取得してください。'
    } finally {
      // blockedはこの要求自身の失敗でも立つので、完了判定はidentity/sequenceを直接照合する。
      if (value.live && value.epoch === epoch && value.actor === actor && value.sequence === sequence && !controller.signal.aborted) {
        value.loading = false
        notify()
      }
    }
  }, [epoch, actor, current, notify])

  const invalidate = useCallback((synchronous: boolean) => {
    const value = state.current
    value.initialUnused = false
    value.restoreCycle++
    value.needsRestore = true
    value.proofActor = ''
    value.sessionStarted = false
    value.epoch++
    value.sequence++
    value.controller?.abort()
    value.data = null
    value.loading = false
    value.blocked = false
    value.error = null
    if (synchronous) flushSync(notify)
    else notify()
  }, [notify])

  const confirmSession = useCallback((synchronous = false) => {
    invalidate(synchronous)
    const value = state.current
    const cycle = value.restoreCycle
    value.checkingSession = true
    value.sessionStarted = true
    notify()
    void Promise.resolve().then(() => latestUpdate.current()).then(session => {
      if (!value.live || value.restoreCycle !== cycle) return
      value.proofActor = typeof session?.user?.id === 'string' ? session.user.id : ''
      // 古いserver propsは採用しない。現在のserver sessionとSDKの一致から新GETへ回復する。
      value.waitForPropActor = ''
      if (!value.proofActor) value.error = 'ログイン状態を再確認できませんでした。ログインし直してください。'
    }).catch(() => {
      if (value.live && value.restoreCycle === cycle) value.error = 'ログイン状態を再確認できませんでした。再確認してください。'
    }).finally(() => {
      if (value.live && value.restoreCycle === cycle) {
        value.checkingSession = false
        notify()
      }
    })
  }, [invalidate, notify])

  useEffect(() => {
    const value = state.current
    value.live = true
    notify()
    const hide = () => invalidate(true)
    const show = (event: PageTransitionEvent) => { if (event.persisted) confirmSession(true) }
    window.addEventListener('pagehide', hide)
    window.addEventListener('pageshow', show)
    return () => {
      value.live = false
      value.sequence++
      value.epoch++
      value.controller?.abort()
      window.removeEventListener('pagehide', hide)
      window.removeEventListener('pageshow', show)
    }
  }, [notify, invalidate, confirmSession])

  useEffect(() => {
    if (ready && !a.data && !a.loading && !a.blocked) void refresh()
  }, [epoch, ready, refresh, a])

  if (!ready || a.blocked || !a.data || a.data.actorId !== actor) return <section aria-label="ホームの認証確認" role="status">
    <p>{a.error || (scope.status === 'unauthenticated' ? 'ログインが必要です。' : 'ログイン状態と最新の数字を確認しています。')}</p>
    {a.authenticated ? <button type="button" onClick={() => { if (a.blocked || a.waitForPropActor || a.needsRestore) confirmSession(); else void refresh() }} disabled={a.loading || a.checkingSession}>再取得する</button> : null}
    <Link href="/auth/signin?callbackUrl=/home">ログイン画面へ</Link>
  </section>
  return <div key={epoch} onClickCapture={event => { if (!current()) { event.preventDefault(); event.stopPropagation() } }} onSubmitCapture={event => { if (!current()) { event.preventDefault(); event.stopPropagation() } }}>
    {children({ summary: a.data, loading: a.loading, error: a.error, refresh: () => { void refresh() }, current, epoch })}
  </div>
}
