'use client'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { clearBannerTextIntent, createBannerTextIntent, readBannerTextIntent, readBannerTextResponse, type BannerTextIntent, type BannerTextResult } from './text-client'

export function useBannerTextRecovery(status: string, actor: string, kind: 'chat' | 'copy') {
  const storageActor = JSON.stringify([kind, actor])
  const scope = JSON.stringify([status, actor, kind])
  const epoch = useRef({ scope, revision: 0 })
  if (epoch.current.scope !== scope) epoch.current = { scope, revision: epoch.current.revision + 1 }
  const key = JSON.stringify([scope, epoch.current.revision])
  const latest = useRef(key)
  useLayoutEffect(() => { latest.current = key }, [key])
  const mounted = useRef(false)
  const [intent, setIntent] = useState<BannerTextIntent | null>(null)
  const [result, setResult] = useState<BannerTextResult | null>(null)
  const accepted = useRef<BannerTextResult | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const pending = useRef<AbortController | null>(null)
  const allowed = status === 'authenticated' && Boolean(actor)
  const current = () => mounted.current && latest.current === key
  const sync = () => {
    if (!current()) return
    try { const saved = allowed ? readBannerTextIntent(storageActor) : null; setIntent(saved); setResult(previous => previous?.operationId === saved?.operationId ? previous : null); setMessage('') }
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
  const accept = (saved: BannerTextIntent, value: BannerTextResult) => {
    if (!current()) return
    if (readBannerTextIntent(storageActor)?.operationId !== saved.operationId) { sync(); return }
    setIntent(saved)
    accepted.current = value
    setResult(value)
    setMessage(value.state === 'pending' ? 'AI返信は処理中か、結果の確認が必要です。新しいAI返信を送信せず、時間をおいて結果を確認してください。' : value.state === 'missing' ? 'まだ受付記録がありません。通信中の可能性があるため「未受付の操作を終了」で確認してから次に進んでください。' : value.state === 'failed' ? 'このAI返信は失敗が確認されました。操作を閉じて、新しいAI返信を始められます。' : value.state === 'cancelled' ? '未受付の操作を終了しました。操作を閉じて、新しいAI返信を始められます。' : value.state === 'unavailable' ? 'AI返信結果は保存期間外か、削除されています。この操作は再実行されません。' : '')
  }
  const submit = async (body: Record<string, unknown>, signal: AbortSignal) => {
    if (!allowed || !current() || pending.current) throw new Error('ログイン状態と前のAI返信結果を確認してください。')
    let saved: BannerTextIntent
    try {
      if (!navigator.locks) throw new Error('このブラウザでは安全に操作を保存できません。最新のブラウザでお試しください。')
      saved = await navigator.locks.request('banner-text-intent:' + storageActor, () => {
        if (!current() || signal.aborted) throw new Error('操作が中断されました。')
        return createBannerTextIntent(storageActor)
      }) // Must succeed before the network request, serialized across tabs.
      if (!current() || signal.aborted) throw new Error('操作が中断されました。')
    } catch {
      if (current()) { sync(); setMessage('操作情報を保存できず、AI返信を開始していません。前の操作を確認するか、ブラウザの設定を確認して画面を開き直してください。') }
      throw new Error('AI返信は開始されていません。操作情報を確認してください。')
    }
    setIntent(saved)
    setResult(null)
    const controller = new AbortController()
    const abort = () => controller.abort()
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) abort()
    pending.current = controller
    setBusy(true)
    try {
      const response = await fetch('/api/banner/' + kind, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal, body: JSON.stringify({ ...body, operationId: saved.operationId }) })
      const value = await readBannerTextResponse(response, saved.operationId, controller.signal)
      if (!current()) return null
      if (readBannerTextIntent(storageActor)?.operationId !== saved.operationId) { sync(); return null }
      if (value.state === 'limit') { clearBannerTextIntent(storageActor, saved.operationId); setIntent(readBannerTextIntent(storageActor)); setMessage(''); return value }
      accept(saved, value)
      return value
    } catch (error) {
      if (current()) setMessage('応答を確認できませんでした。「AI返信結果を確認」で保存結果を確認してください。')
      throw error
    } finally {
      signal.removeEventListener('abort', abort)
      if (pending.current === controller) pending.current = null
      if (current()) setBusy(false)
      controller.abort()
    }
  }
  const recover = async (cancel = false) => {
    if (!allowed || !current() || pending.current) return
    let saved: BannerTextIntent | null
    try { saved = readBannerTextIntent(storageActor) } catch (error) { setMessage(error instanceof Error ? error.message : '操作情報を確認できません。'); return }
    if (!saved) { sync(); return }
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), 45000)
    pending.current = controller
    setBusy(true)
    try {
      const response = await fetch('/api/banner/' + kind + '?operationId=' + encodeURIComponent(saved.operationId), { method: cancel ? 'DELETE' : 'GET', signal: controller.signal, cache: 'no-store' })
      const value = await readBannerTextResponse(response, saved.operationId, controller.signal)
      if (value.state === 'limit') throw new Error('結果確認の応答が正しくありません。')
      accept(saved, value)
    } catch { if (current()) setMessage('保存結果を確認できませんでした。新しいAI返信は送信せず、時間をおいてもう一度確認してください。') }
    finally { window.clearTimeout(timer); controller.abort(); if (pending.current === controller) pending.current = null; if (current()) setBusy(false) }
  }
  const acknowledge = (operationId?: string) => {
    if (!current() || !allowed || pending.current || !operationId || accepted.current?.operationId !== operationId || !['completed', 'failed', 'cancelled'].includes(accepted.current.state)) return
    try { clearBannerTextIntent(storageActor, operationId); setIntent(readBannerTextIntent(storageActor)); accepted.current = null; setResult(null); setMessage('') }
    catch { setMessage('操作情報を更新できません。新しいAI返信は開始せずお問い合わせください。') }
  }
  return { intent, result, message, busy, blocked: !allowed || Boolean(intent) || Boolean(message) || busy, submit, recover, acknowledge }
}
