'use client'

import { useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { waitForBillingClientTask } from '@/lib/billing-response-client'
import { readAioStartResponse } from './quick-start-response-client'
import { readAioStartIntent, claimAioStartIntent, clearAioStartIntent, aioStartHostHash, type AioStartIntent } from './quick-start-intent-client'

type Phase = 'unknown' | 'missing' | 'ready' | 'pending' | 'cancelling' | 'completed' | 'failed' | 'cancelled' | 'busy'
type View = { actor: string; intent: AioStartIntent | null; phase: Phase; slug: string | null; error: string | null; busy: boolean; ready: boolean }
const unknown = '開始処理の保存状況を確認できませんでした。新しく開始せず、保存状況を確認してください。'
const validSlug = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 180 && !/[\s/\\?#\u0000-\u001f\u007f]/.test(v)
export function useAioQuickStart(options: { url: string; onComplete: (slug: string, autoScan: boolean) => void; onSignIn: () => Promise<void> }) {
  const { data: session, status } = useSession()
  const actor = status === 'authenticated' ? session?.user?.id || '' : ''
  const epoch = useRef({ actor, version: 0 }), pending = useRef<AbortController | null>(null), alive = useRef(true), cancelling = useRef(false)
  if (epoch.current.actor !== actor) {
    epoch.current = { actor, version: epoch.current.version + 1 }
    pending.current?.abort(); pending.current = null; cancelling.current = false
  }
  const version = epoch.current.version
  const [view, setView] = useState<View>({ actor, intent: null, phase: 'unknown', slug: null, error: null, busy: false, ready: false })
  const actionRef = useRef<(mode: 'recover') => void>(() => {})
  useEffect(() => { alive.current = true; return () => { alive.current = false; pending.current?.abort(); pending.current = null } }, [])
  async function signIn() {
    if (pending.current || status === 'loading' || !alive.current) return
    const controller = new AbortController()
    pending.current = controller
    const current = () => alive.current && epoch.current.version === version && pending.current === controller && !controller.signal.aborted
    setView(v => ({ ...v, actor, busy: true }))
    try { await waitForBillingClientTask(options.onSignIn, controller.signal) }
    catch { if (current()) setView(v => ({ ...v, actor, error: 'ログインを開始できませんでした。もう一度ログインを確認してください。' })) }
    finally {
      if (current()) { pending.current = null; setView(v => ({ ...v, busy: false })) }
      controller.abort()
    }
  }
  async function run(mode: 'new' | 'recover' | 'resume' | 'cancel' | 'open') {
    if (pending.current || !alive.current || epoch.current.version !== version) return
    if (!actor) { if (mode === 'new' && status !== 'loading') await signIn(); return }
    if (mode === 'new' && (!view.ready || view.actor !== actor)) return
    const controller = new AbortController(), scope = { actor }
    pending.current = controller
    const current = () => alive.current && epoch.current.version === version && pending.current === controller && !controller.signal.aborted
    setView(v => ({ ...v, actor, busy: true, error: null }))
    try {
      let intent = readAioStartIntent(scope), created = false
      if (mode === 'new' && !intent) {
        const hostHash = await aioStartHostHash(options.url)
        if (!current()) return
        const claim = await claimAioStartIntent(scope, hostHash, controller.signal)
        intent = claim.intent; created = claim.created
      }
      if (!current()) return
      if (!intent) { setView({ actor, intent: null, phase: 'unknown', slug: null, error: null, busy: false, ready: true }); return }
      setView(v => ({ ...v, actor, intent }))
      if (mode === 'open') {
        if (view.actor !== actor || view.phase !== 'completed' || !validSlug(view.slug)) throw new Error(unknown)
        await clearAioStartIntent(scope, intent.operationId, controller.signal)
        if (current()) options.onComplete(view.slug, false)
        return
      }
      let post = created
      if (mode === 'resume') {
        if (await aioStartHostHash(options.url) !== intent.hostHash) throw new Error('前の開始処理と同じサイトのURLを入力してください。')
        if (!current()) return
        post = true
      }
      const response = await readAioStartResponse('/api/aio/quick-start' + (!post && mode !== 'cancel' ? '?operationId=' + intent.operationId : ''),
        post ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ operationId: intent.operationId, url: options.url }) }
          : mode === 'cancel' ? { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ operationId: intent.operationId }) } : { method: 'GET' }, controller.signal)
      if (!current() || readAioStartIntent(scope)?.operationId !== intent.operationId) return
      if (response.status === 401) {
        setView(v => ({ ...v, actor, intent, error: 'ログイン状態を確認してから保存状況を確認してください。', busy: false, ready: true }))
        return
      }
      const d = response.data
      if (d.operationId !== intent.operationId || typeof d.state !== 'string' || !['missing', 'ready', 'pending', 'cancelling', 'completed', 'failed', 'cancelled', 'busy'].includes(d.state)) throw new Error(unknown)
      if (d.state === 'completed') {
        if (!response.ok || d.success !== true || !validSlug(d.slug) || typeof d.organizationId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(d.organizationId)) throw new Error(unknown)
        setView({ actor, intent, phase: 'completed', slug: d.slug, error: null, busy: false, ready: true })
        // A recovered workspace must not silently trigger another paid scan.
        if (created) {
          await clearAioStartIntent(scope, intent.operationId, controller.signal)
          if (current()) options.onComplete(d.slug, true)
        }
        return
      }
      if (mode === 'cancel' && ['cancelled', 'failed'].includes(d.state)) {
        await clearAioStartIntent(scope, intent.operationId, controller.signal)
        if (current()) setView({ actor, intent: null, phase: 'cancelled', slug: null, error: null, busy: false, ready: true })
        return
      }
      setView({ actor, intent, phase: d.state as Phase, slug: null,
        error: typeof d.error === 'string' && d.error.length <= 500 ? d.error : null, busy: false, ready: true })
    } catch (error) {
      if (!current()) return
      const saved = readSafeIntent(actor)
      setView(v => ({ ...v, actor, intent: saved.intent, ready: saved.valid, error: error instanceof Error && error.message.startsWith('前の開始処理と') ? error.message : unknown, busy: false }))
    } finally {
      if (current()) { pending.current = null; setView(v => ({ ...v, busy: false })) }
      controller.abort()
    }
  }
  function cancel() {
    if (cancelling.current) return
    pending.current?.abort(); pending.current = null; cancelling.current = true
    void run('cancel').finally(() => { cancelling.current = false })
  }
  actionRef.current = () => { void run('recover') }
  useEffect(() => {
    if (!actor) return
    const load = () => {
      try {
        const intent = readAioStartIntent({ actor })
        setView({ actor, intent, phase: 'unknown', slug: null, error: null, busy: !!pending.current, ready: true })
        if (intent) actionRef.current('recover')
      } catch { setView({ actor, intent: null, phase: 'unknown', slug: null, error: '保存された開始情報を確認できません。新しく開始せずお問い合わせください。', busy: false, ready: false }) }
    }
    load()
    const sync = (event: StorageEvent) => { if (event.key === null || event.key === 'aio-quick-start-intent:v1:' + actor) load() }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [actor])
  useEffect(() => {
    const stopWaiting = () => { pending.current?.abort(); pending.current = null; cancelling.current = false }
    const restore = (event: PageTransitionEvent) => {
      if (!event.persisted) return
      stopWaiting()
      actionRef.current('recover')
    }
    window.addEventListener('pagehide', stopWaiting)
    window.addEventListener('pageshow', restore)
    return () => { window.removeEventListener('pagehide', stopWaiting); window.removeEventListener('pageshow', restore) }
  }, [])
  const visible = view.actor === actor && status !== 'loading' ? view : null
  return { view: visible, disabled: status === 'loading' || !!visible?.busy || !!visible?.intent || (status === 'authenticated' && !visible?.ready),
    start: () => run('new'), recover: () => run('recover'), resume: () => run('resume'), open: () => run('open'), cancel, signIn }
}
function readSafeIntent(actor: string) { try { return { intent: readAioStartIntent({ actor }), valid: true } } catch { return { intent: null, valid: false } } }
