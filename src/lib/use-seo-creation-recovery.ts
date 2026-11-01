'use client'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { readBillingResponse } from '@/lib/billing-response-client'

type Intent = { version: 1; operationId: string }
type Result = { operationId: string; state: 'found' | 'missing' | 'cancelled' | 'unavailable'; articleId: string | null; jobId: string | null }
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value)
const savedId = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value)
const storageMessage = '操作情報を安全に保存・確認できません。新しく作成せず、ブラウザの設定と記事一覧を確認してください。'
function readIntent(key: string): Intent | null {
  const raw = window.localStorage.getItem(key)
  if (raw === null) return null
  if (raw.length > 1024) throw Error(storageMessage)
  const value: unknown = JSON.parse(raw)
  const row = value as Intent
  if (!row || typeof row !== 'object' || Array.isArray(row) || row.version !== 1 || !uuid(row.operationId) || Object.keys(row).some(k => !['version', 'operationId'].includes(k))) throw Error(storageMessage)
  return row
}
function parseResult(data: Record<string, unknown>, operationId: string): Result {
  const row = data as unknown as Result & { success?: unknown }
  if (row.success !== true || row.operationId !== operationId || !['found', 'missing', 'cancelled', 'unavailable'].includes(row.state) || Object.keys(data).some(k => !['success', 'operationId', 'state', 'articleId', 'jobId'].includes(k))) throw Error('作成結果の形式を確認できません。新しく作成せず、再確認してください。')
  if (row.state === 'found' ? !savedId(row.articleId) || !(row.jobId === null || savedId(row.jobId)) : row.articleId !== null || row.jobId !== null) throw Error('作成結果の形式を確認できません。')
  return row
}
export function useSeoCreationRecovery(status: string, actor: string) {
  const allowed = status === 'authenticated' && Boolean(actor)
  const storageKey = 'seo-article-create-intent:v1:' + JSON.stringify(actor)
  const scope = JSON.stringify([status, actor])
  const epoch = useRef({ scope, version: 0 })
  if (epoch.current.scope !== scope) epoch.current = { scope, version: epoch.current.version + 1 }
  const key = JSON.stringify([scope, epoch.current.version])
  const latest = useRef(key), mounted = useRef(false)
  useLayoutEffect(() => { latest.current = key; mounted.current = true; return () => { mounted.current = false } }, [key])
  const current = () => mounted.current && latest.current === key
  const [snapshot, setSnapshot] = useState<{ key: string; ready: boolean; intent: Intent | null }>({ key: '', ready: false, intent: null })
  const [result, setResult] = useState<Result | null>(null)
  const accepted = useRef<Result | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const sync = () => {
    if (!current()) return
    try {
      const intent = actor ? readIntent(storageKey) : null
      setSnapshot({ key, ready: true, intent }); setMessage('')
      if (accepted.current?.operationId !== intent?.operationId) { accepted.current = null; setResult(null) }
    } catch { setSnapshot({ key, ready: false, intent: null }); setMessage(storageMessage) }
  }
  useEffect(() => {
    accepted.current = null; setResult(null); setBusy(false); sync()
    const changed = (event: StorageEvent) => { if (event.key === null || event.key === storageKey) sync() }
    const focus = () => sync()
    window.addEventListener('storage', changed); window.addEventListener('focus', focus)
    return () => { window.removeEventListener('storage', changed); window.removeEventListener('focus', focus) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  const locked = async <T,>(action: () => T | Promise<T>): Promise<T> => {
    if (!window.navigator.locks) throw Error(storageMessage)
    return window.navigator.locks.request(storageKey, action)
  }
  const begin = async (signal: AbortSignal): Promise<Intent> => {
    if (!allowed || !current() || signal.aborted) throw Error('ログイン状態を確認してください。')
    try {
      const intent = await locked(() => {
        if (!current() || signal.aborted) throw Error('操作が中断されました。')
        if (readIntent(storageKey)) throw Error('前回の記事作成の結果を先に確認してください。')
        const operationId = window.crypto.randomUUID()
        if (!uuid(operationId)) throw Error(storageMessage)
        const saved: Intent = { version: 1, operationId }
        window.localStorage.setItem(storageKey, JSON.stringify(saved))
        if (readIntent(storageKey)?.operationId !== operationId) throw Error(storageMessage)
        return saved
      })
      if (!current() || signal.aborted) throw Error('操作が中断されました。')
      setSnapshot({ key, ready: true, intent }); accepted.current = null; setResult(null); setMessage('')
      return intent
    } catch { if (current()) { sync(); setMessage(storageMessage) }; throw Error(storageMessage) }
  }
  const clearKnown = async (operationId: string): Promise<boolean> => {
    try {
      return await locked(() => {
        if (!current() || !allowed || readIntent(storageKey)?.operationId !== operationId) return false
        window.localStorage.removeItem(storageKey)
        if (readIntent(storageKey) !== null) throw Error(storageMessage)
        setSnapshot({ key, ready: true, intent: null }); accepted.current = null; setResult(null); setMessage(''); return true
      })
    } catch { if (current()) { sync(); setMessage(storageMessage) }; return false }
  }
  const acceptCreated = (operationId: string, articleId: string, jobId: string | null) => {
    if (!current() || !uuid(operationId) || !savedId(articleId) || !(jobId === null || savedId(jobId))) return
    const value: Result = { operationId, state: 'found', articleId, jobId }
    accepted.current = value; setResult(value)
  }
  const recover = async (cancel: boolean, signal: AbortSignal): Promise<Result | null> => {
    if (!allowed || !current() || pending.current || signal.aborted) return null
    pending.current = true; setBusy(true); setMessage('')
    try {
      const intent = readIntent(storageKey)
      if (!intent) { sync(); return null }
      const response = await readBillingResponse('/api/seo/article-operation?operationId=' + encodeURIComponent(intent.operationId), { method: cancel ? 'DELETE' : 'GET', cache: 'no-store' }, signal)
      if (!current() || signal.aborted) return null
      if (response.status === 429 && response.data.code === 'SEO_CREATION_RECOVERY_LIMIT') {
        setMessage('未受付の操作を終了できる回数が本日の上限（100回）に達しました。日本時間の午前0時以降に再確認してください。記事一覧と作成済みの記事の結果確認は引き続き利用できます。')
        return null
      }
      if (!response.ok || response.status !== 200) throw Error('作成結果を確認できません。新しく作成せず、ログイン状態を確認して再確認してください。')
      const value = parseResult(response.data, intent.operationId)
      if (readIntent(storageKey)?.operationId !== intent.operationId) { sync(); return null }
      accepted.current = value; setResult(value)
      setMessage(value.state === 'missing' ? 'まだ受付記録を確認できません。通信中の可能性があるため、新しく作成する前に「未受付の操作を終了」を押してください。' : value.state === 'unavailable' ? '作成記録はありますが、記事または生成ジョブが削除されているか、現在開けません。この操作は再実行しません。' : value.state === 'cancelled' ? '未受付の操作を終了しました。新しい記事作成へ進めます。' : '前回の記事は保存済みです。下のリンクから開けます。')
      return value
    } catch { if (current()) setMessage('作成結果を確認できませんでした。新しく作成せず、時間をおいて再確認してください。'); return null }
    finally { pending.current = false; if (current()) setBusy(false) }
  }
  const acknowledge = async (operationId: string): Promise<boolean> => {
    if (!current() || !allowed || pending.current || accepted.current?.operationId !== operationId || !['found', 'cancelled', 'unavailable'].includes(accepted.current.state)) return false
    return clearKnown(operationId)
  }
  const intent = snapshot.key === key ? snapshot.intent : null
  return { ready: allowed && snapshot.key === key && snapshot.ready, intent, result: result?.operationId === intent?.operationId ? result : null, message, busy, begin, clearKnown, acceptCreated, recover, acknowledge }
}
