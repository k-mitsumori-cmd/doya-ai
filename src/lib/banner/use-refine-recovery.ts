'use client'
import { useEffect, useRef, useState } from 'react'
import { clearBannerRefineIntent, createBannerRefineIntent, readBannerRefineIntent, readBannerRefineResponse, type BannerRefineIntent, type BannerRefineResult } from './refine-client'

export function useBannerRefineRecovery(status: string, actor: string) {
  const scope = JSON.stringify([status, actor])
  const epoch = useRef({ scope, revision: 0 })
  if (epoch.current.scope !== scope) epoch.current = { scope, revision: epoch.current.revision + 1 }
  const key = JSON.stringify([scope, epoch.current.revision])
  const latest = useRef(key)
  latest.current = key
  const mounted = useRef(false)
  const [intent, setIntent] = useState<BannerRefineIntent | null>(null)
  const [result, setResult] = useState<BannerRefineResult | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const pending = useRef<AbortController | null>(null)
  const allowed = status === 'authenticated' && Boolean(actor)
  const current = () => mounted.current && latest.current === key
  const sync = () => {
    if (!current()) return
    try { const saved = allowed ? readBannerRefineIntent(actor) : null; setIntent(saved); setResult(previous => previous?.operationId === saved?.operationId ? previous : null); setMessage('') }
    catch (error) { setMessage(error instanceof Error ? error.message : '操作情報を確認できません。') }
  }
  useEffect(() => {
    mounted.current = true
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
  const accept = (saved: BannerRefineIntent, value: BannerRefineResult) => {
    if (!current()) return
    if (readBannerRefineIntent(actor)?.operationId !== saved.operationId) { sync(); return }
    setIntent(saved)
    setResult(value)
    setMessage(value.state === 'pending' ? '修正は処理中か、結果の確認が必要です。新しい修正を送信せず、時間をおいて結果を確認してください。' : value.state === 'missing' ? 'まだ受付記録がありません。通信中の可能性があるため「未受付の操作を終了」で確認してから次に進んでください。' : value.state === 'failed' ? 'この修正は失敗が確認されました。操作を閉じて、新しい修正を始められます。' : value.state === 'cancelled' ? '未受付の操作を終了しました。操作を閉じて、新しい修正を始められます。' : value.state === 'unavailable' ? '修正結果は保存期間外か、削除されています。この操作は再実行されません。' : '')
  }
  const submit = async (body: { originalImage: string; instruction: string; category?: string; size?: string }, signal: AbortSignal) => {
    if (!allowed || !current() || pending.current) throw new Error('ログイン状態と前の修正結果を確認してください。')
    let saved: BannerRefineIntent
    try {
      if (!navigator.locks) throw new Error('このブラウザでは安全に操作を保存できません。最新のブラウザでお試しください。')
      saved = await navigator.locks.request('banner-refine-intent:' + actor, () => {
        if (!current() || signal.aborted) throw new Error('操作が中断されました。')
        return createBannerRefineIntent(actor)
      }) // Must succeed before the network request, serialized across tabs.
      if (!current() || signal.aborted) throw new Error('操作が中断されました。')
    } catch {
      if (current()) { sync(); setMessage('操作情報を保存できず、修正を開始していません。前の操作を確認するか、ブラウザの設定を確認して画面を開き直してください。') }
      throw new Error('修正は開始されていません。操作情報を確認してください。')
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
      const response = await fetch('/api/banner/refine', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal, body: JSON.stringify({ ...body, operationId: saved.operationId }) })
      const value = await readBannerRefineResponse(response, saved.operationId, controller.signal)
      if (!current()) return null
      if (readBannerRefineIntent(actor)?.operationId !== saved.operationId) { sync(); return null }
      if (value.state === 'limit') { clearBannerRefineIntent(actor, saved.operationId); setIntent(readBannerRefineIntent(actor)); setMessage(''); return value }
      accept(saved, value)
      return value
    } catch (error) {
      if (current()) setMessage('応答を確認できませんでした。「修正結果を確認」で保存結果を確認してください。')
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
    let saved: BannerRefineIntent | null
    try { saved = readBannerRefineIntent(actor) } catch (error) { setMessage(error instanceof Error ? error.message : '操作情報を確認できません。'); return }
    if (!saved) { sync(); return }
    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), 45000)
    pending.current = controller
    setBusy(true)
    try {
      const response = await fetch('/api/banner/refine?operationId=' + encodeURIComponent(saved.operationId), { method: cancel ? 'DELETE' : 'GET', signal: controller.signal, cache: 'no-store' })
      const value = await readBannerRefineResponse(response, saved.operationId, controller.signal)
      if (value.state === 'limit') throw new Error('結果確認の応答が正しくありません。')
      accept(saved, value)
    } catch { if (current()) setMessage('保存結果を確認できませんでした。新しい修正は送信せず、時間をおいてもう一度確認してください。') }
    finally { window.clearTimeout(timer); controller.abort(); if (pending.current === controller) pending.current = null; if (current()) setBusy(false) }
  }
  const acknowledge = (operationId?: string) => {
    if (!current() || !allowed || pending.current || !operationId || result?.operationId !== operationId || !['completed', 'failed', 'cancelled', 'unavailable'].includes(result.state)) return
    try { clearBannerRefineIntent(actor, operationId); setIntent(readBannerRefineIntent(actor)); setResult(null); setMessage('') }
    catch { setMessage('操作情報を更新できません。新しい修正は開始せずお問い合わせください。') }
  }
  return { intent, result, message, busy, blocked: !allowed || Boolean(intent) || Boolean(message) || busy, submit, recover, acknowledge }
}
