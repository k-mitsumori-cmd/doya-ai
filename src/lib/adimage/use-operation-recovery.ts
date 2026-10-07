'use client'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { clearAdImageIntent, createAdImageIntent, readAdImageIntent, fetchAdImageOperation, readAdImageOperationResponse, type AdImageIntent, type AdImageResult } from './operation-client'

const LOGIN_MESSAGE = 'ログインの有効期限が切れた可能性があります。再ログイン後に保存結果を確認してください。'

export function useAdImageRecovery(status: string, actor: string) {
  const storageActor = JSON.stringify([actor])
  const scope = JSON.stringify([status, actor])
  const epoch = useRef({ scope, revision: 0 })
  if (epoch.current.scope !== scope) epoch.current = { scope, revision: epoch.current.revision + 1 }
  const key = JSON.stringify([scope, epoch.current.revision])
  const latest = useRef(key)
  useLayoutEffect(() => { latest.current = key }, [key])
  const mounted = useRef(false)
  const [readyKey, setReadyKey] = useState('')
  const [intent, setIntent] = useState<AdImageIntent | null>(null)
  const [result, setResult] = useState<AdImageResult | null>(null)
  const accepted = useRef<AdImageResult | null>(null)
  const [message, setMessage] = useState('')
  const [authKey, setAuthKey] = useState('')
  const authFence = useRef('')
  const [busy, setBusy] = useState(false)
  const pending = useRef<AbortController | null>(null)
  const allowed = status === 'authenticated' && Boolean(actor)
  const current = () => mounted.current && latest.current === key
  const sync = () => {
    if (!current()) return
    try { const saved = allowed ? readAdImageIntent(actor) : null; setIntent(saved); setResult(previous => previous?.operationId === saved?.operationId ? previous : null); setMessage('') }
    catch (error) { setMessage(error instanceof Error ? error.message : '操作情報を確認できません。') }
  }
  useEffect(() => {
    mounted.current = true
    setReadyKey(key)
    accepted.current = null
    setResult(null)
    setBusy(false)
    sync()
    // A second page/tab must see a previously recorded operation before another submit.
    const changed = () => sync()
    window.addEventListener('storage', changed)
    window.addEventListener('focus', changed)
    return () => {
      mounted.current = false
      pending.current?.abort()
      pending.current = null
      window.removeEventListener('storage', changed)
      window.removeEventListener('focus', changed)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  const requireLogin = (saved: AdImageIntent, response: Response) => {
    void response.body?.cancel().catch(() => {})
    if (!current() || readAdImageIntent(actor)?.operationId !== saved.operationId) return
    authFence.current = key
    setAuthKey(key)
    accepted.current = null
    setResult(null)
    setIntent(saved)
    setMessage(LOGIN_MESSAGE)
  }
  const accept = (saved: AdImageIntent, value: AdImageResult) => {
    if (!current()) return
    if (readAdImageIntent(actor)?.operationId !== saved.operationId) { sync(); return }
    authFence.current = ''
    setAuthKey('')
    setIntent(saved)
    accepted.current = value
    setResult(value)
    setMessage(value.state === 'limit' ? '利用枠の上限に達しました。プランを確認するか、この操作を閉じてください。' : value.state === 'busy' ? '別の処理が進んでいます。新しい操作はせず、時間をおいて保存結果を確認してください。' : value.state === 'pending' ? '処理中か、結果の確認が必要です。新しい操作を開始せず、時間をおいて結果を確認してください。' : value.state === 'missing' ? 'まだ受付記録がありません。通信中の可能性があるため「未受付の操作を終了」で確認してから次に進んでください。' : value.state === 'failed' ? 'この操作は失敗が確認されました。操作を閉じて、新しい操作を始められます。' : value.state === 'cancelled' ? '未受付の操作を終了しました。操作を閉じて、新しい操作を始められます。' : value.state === 'unavailable' ? '結果は削除されたか、対象が変更されています。この操作は再実行されません。' : '')
  }
  const submit = async (kind: AdImageIntent['kind'], targetId: string, body: Record<string, unknown>, signal: AbortSignal) => {
    if (!allowed || !current() || pending.current || authFence.current === key) throw new Error('ログイン状態と前の生成結果を確認してください。')
    let saved: AdImageIntent
    try {
      if (!navigator.locks) throw new Error('このブラウザでは安全に操作を保存できません。最新のブラウザでお試しください。')
      saved = await navigator.locks.request('adimage-intent:' + storageActor, () => {
        if (!current() || signal.aborted || authFence.current === key) throw new Error('操作が中断されました。')
        return createAdImageIntent(actor, kind, targetId)
      }) // Must succeed before the network request, serialized across tabs.
      if (!current() || signal.aborted || authFence.current === key) throw new Error('操作が中断されました。')
    } catch {
      if (current()) { sync(); setMessage('操作情報を保存できず、生成を開始していません。前の操作を確認するか、ブラウザの設定を確認して画面を開き直してください。') }
      throw new Error('生成は開始されていません。操作情報を確認してください。')
    }
    setIntent(saved)
    setResult(null)
    const controller = new AbortController()
    const abort = () => controller.abort()
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) abort()
    pending.current = controller
    const timer = window.setTimeout(() => controller.abort(), 315000)
    setBusy(true)
    try {
      const response = await fetchAdImageOperation(kind === 'analyze' ? '/api/adimage/analyze' : kind === 'generate' ? '/api/adimage/concepts' : `/api/adimage/concepts/${encodeURIComponent(targetId)}/${kind === 'feedback' ? 'feedback' : 'refine'}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, operationId: saved.operationId }) }, controller.signal)
      if (response.status === 401) { requireLogin(saved, response); return null }
      const value = await readAdImageOperationResponse(response, saved, controller.signal)
      if (!current()) return null
      if (readAdImageIntent(actor)?.operationId !== saved.operationId) { sync(); return null }
      if (value.state === 'limit') { accept(saved, value); return value }
      accept(saved, value)
      return value
    } catch (error) {
      if (current()) setMessage('応答を確認できませんでした。「保存結果を確認」で保存結果を確認してください。')
      throw new Error('応答を確認できませんでした。新しい生成は開始せず「保存結果を確認」を押してください。')
    } finally {
      window.clearTimeout(timer)
      signal.removeEventListener('abort', abort)
      if (pending.current === controller) pending.current = null
      if (current()) setBusy(false)
      controller.abort()
    }
  }
  const recover = async (cancel = false) => {
    if (!allowed || !current() || pending.current) return
    let saved: AdImageIntent | null
    try { saved = readAdImageIntent(actor) } catch (error) { setMessage(error instanceof Error ? error.message : '操作情報を確認できません。'); return }
    if (!saved) { sync(); return }
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), 45000)
    pending.current = controller
    setBusy(true)
    try {
      const query = new URLSearchParams({ operationId: saved.operationId, targetId: saved.targetId, kind: saved.kind })
      const response = await fetchAdImageOperation('/api/adimage/operations?' + query, { method: cancel ? 'DELETE' : 'GET', cache: 'no-store' }, controller.signal)
      if (response.status === 401) { requireLogin(saved, response); return }
      const value = await readAdImageOperationResponse(response, saved, controller.signal)
      if (value.state === 'limit') throw new Error('結果確認の応答が正しくありません。')
      accept(saved, value)
    } catch { if (current()) setMessage('保存結果を確認できませんでした。新しい生成は開始せず、時間をおいてもう一度確認してください。') }
    finally { window.clearTimeout(timer); controller.abort(); if (pending.current === controller) pending.current = null; if (current()) setBusy(false) }
  }
  const acknowledge = (operationId?: string): boolean => {
    if (!current() || !allowed || pending.current || authFence.current === key || !operationId || accepted.current?.operationId !== operationId || !['completed', 'failed', 'cancelled', 'unavailable', 'limit'].includes(accepted.current.state)) return false
    try {
      if (readAdImageIntent(actor)?.operationId !== operationId) { sync(); return false }
      clearAdImageIntent(actor, operationId)
      setIntent(readAdImageIntent(actor))
      accepted.current = null
      setResult(null)
      setMessage('')
      return true
    } catch { setMessage('操作情報を更新できません。新しい生成は開始せずお問い合わせください。'); return false }
  }
  const ready = readyKey === key
  const authRequired = ready && authKey === key
  return { authRequired, intent: ready ? intent : null, result: ready ? result : null, message: authRequired ? LOGIN_MESSAGE : ready ? message : '', busy: ready && busy, blocked: authRequired || !allowed || !ready || Boolean(intent) || Boolean(message) || busy, submit, recover, acknowledge }
}
