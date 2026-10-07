'use client'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { clearDoyaSlideIntent, createDoyaSlideIntent, readDoyaSlideIntent, fetchDoyaSlideOperation, readDoyaSlideOperationResponse, type DoyaSlideIntent, type DoyaSlideResult } from './operation-client'

export function useDoyaSlideRecovery(status: string, actor: string, projectId: string) {
  const storageActor = JSON.stringify([actor, projectId])
  const scope = JSON.stringify([status, actor, projectId])
  const epoch = useRef({ scope, revision: 0 })
  if (epoch.current.scope !== scope) epoch.current = { scope, revision: epoch.current.revision + 1 }
  const key = JSON.stringify([scope, epoch.current.revision])
  const latest = useRef(key)
  useLayoutEffect(() => { latest.current = key }, [key])
  const mounted = useRef(false)
  const [intent, setIntent] = useState<DoyaSlideIntent | null>(null)
  const [result, setResult] = useState<DoyaSlideResult | null>(null)
  const accepted = useRef<DoyaSlideResult | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const pending = useRef<AbortController | null>(null)
  const allowed = status === 'authenticated' && Boolean(actor)
  const current = () => mounted.current && latest.current === key
  const sync = () => {
    if (!current()) return
    try { const saved = allowed ? readDoyaSlideIntent(actor, projectId) : null; setIntent(saved); setResult(previous => previous?.operationId === saved?.operationId ? previous : null); setMessage('') }
    catch (error) { setMessage(error instanceof Error ? error.message : '操作情報を確認できません。') }
  }
  useEffect(() => {
    mounted.current = true
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
  const accept = (saved: DoyaSlideIntent, value: DoyaSlideResult) => {
    if (!current()) return
    if (readDoyaSlideIntent(actor, projectId)?.operationId !== saved.operationId) { sync(); return }
    setIntent(saved)
    accepted.current = value
    setResult(value)
    setMessage(value.state === 'busy' ? '同じ資料で別の生成処理が進んでいます。新しい生成はせず、時間をおいて保存結果を確認してください。' : value.state === 'pending' ? '生成は処理中か、結果の確認が必要です。新しい生成を開始せず、時間をおいて結果を確認してください。' : value.state === 'missing' ? 'まだ受付記録がありません。通信中の可能性があるため「未受付の操作を終了」で確認してから次に進んでください。' : value.state === 'failed' ? 'この生成は失敗が確認されました。操作を閉じて、新しい生成を始められます。' : value.state === 'cancelled' ? '未受付の操作を終了しました。操作を閉じて、新しい生成を始められます。' : value.state === 'unavailable' ? '生成結果は保存期間外か、削除されています。この操作は再実行されません。' : '')
  }
  const submit = async (kind: DoyaSlideIntent['kind'], body: Record<string, unknown>, signal: AbortSignal, slideId?: string) => {
    if (!allowed || !current() || pending.current) throw new Error('ログイン状態と前の生成結果を確認してください。')
    let saved: DoyaSlideIntent
    try {
      if (!navigator.locks) throw new Error('このブラウザでは安全に操作を保存できません。最新のブラウザでお試しください。')
      saved = await navigator.locks.request('doyaslide-intent:' + storageActor, () => {
        if (!current() || signal.aborted) throw new Error('操作が中断されました。')
        return createDoyaSlideIntent(actor, projectId, kind, slideId)
      }) // Must succeed before the network request, serialized across tabs.
      if (!current() || signal.aborted) throw new Error('操作が中断されました。')
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
      const response = await fetchDoyaSlideOperation('/api/doyaslide/operations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, projectId, kind, ...(slideId ? { slideId } : {}), operationId: saved.operationId }) }, controller.signal)
      const value = await readDoyaSlideOperationResponse(response, saved, controller.signal)
      if (!current()) return null
      if (readDoyaSlideIntent(actor, projectId)?.operationId !== saved.operationId) { sync(); return null }
      if (value.state === 'limit') { clearDoyaSlideIntent(actor, projectId, saved.operationId); setIntent(readDoyaSlideIntent(actor, projectId)); setMessage(''); return value }
      accept(saved, value)
      return value
    } catch (error) {
      if (current()) setMessage('応答を確認できませんでした。「保存結果を確認」で保存結果を確認してください。')
      throw error
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
    let saved: DoyaSlideIntent | null
    try { saved = readDoyaSlideIntent(actor, projectId) } catch (error) { setMessage(error instanceof Error ? error.message : '操作情報を確認できません。'); return }
    if (!saved) { sync(); return }
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), 45000)
    pending.current = controller
    setBusy(true)
    try {
      const query = new URLSearchParams({ operationId: saved.operationId, projectId: saved.projectId, kind: saved.kind, ...(saved.slideId ? { slideId: saved.slideId } : {}) })
      const response = await fetchDoyaSlideOperation('/api/doyaslide/operations?' + query, { method: cancel ? 'DELETE' : 'GET', cache: 'no-store' }, controller.signal)
      const value = await readDoyaSlideOperationResponse(response, saved, controller.signal)
      if (value.state === 'limit') throw new Error('結果確認の応答が正しくありません。')
      accept(saved, value)
    } catch { if (current()) setMessage('保存結果を確認できませんでした。新しい生成は開始せず、時間をおいてもう一度確認してください。') }
    finally { window.clearTimeout(timer); controller.abort(); if (pending.current === controller) pending.current = null; if (current()) setBusy(false) }
  }
  const acknowledge = (operationId?: string): boolean => {
    if (!current() || !allowed || pending.current || !operationId || accepted.current?.operationId !== operationId || !['completed', 'failed', 'cancelled', 'empty', 'unavailable'].includes(accepted.current.state)) return false
    try {
      if (readDoyaSlideIntent(actor, projectId)?.operationId !== operationId) { sync(); return false }
      clearDoyaSlideIntent(actor, projectId, operationId)
      setIntent(readDoyaSlideIntent(actor, projectId))
      accepted.current = null
      setResult(null)
      setMessage('')
      return true
    } catch { setMessage('操作情報を更新できません。新しい生成は開始せずお問い合わせください。'); return false }
  }
  return { intent, result, message, busy, blocked: !allowed || Boolean(intent) || Boolean(message) || busy, submit, recover, acknowledge }
}
