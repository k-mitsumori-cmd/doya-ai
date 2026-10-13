'use client'
import { useHrOrganizationRequest } from '@/components/hr/HrOrganizationScope'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
export type EvaluationSaveInput = { evaluationId: string; expectedUpdatedAt: string }
type Intent = { version: 1; operationId: string; actor: string; organizationId: string; input: EvaluationSaveInput }
export type EvaluationSaveResult = { operationId: string; state: 'not_received' | 'canceled' | 'deleted' | 'superseded' } | { operationId: string; state: 'completed'; updatedAt: string }
type View = { key: string; ready: boolean; intent: Intent | null; result: EvaluationSaveResult | null; message: string; loginRequired: boolean }
const storageMessage = '操作情報を安全に保存・確認できません。新しく保存せず、ブラウザの設定と保存内容を確認してください。'
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value)
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const iso = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(new Date(value).getTime()) && new Date(value).toISOString() === value
function validInput(value: unknown): value is EvaluationSaveInput {
  return object(value) && typeof value.evaluationId === 'string' && Boolean(value.evaluationId) && iso(value.expectedUpdatedAt) && Object.keys(value).sort().join(',') === 'evaluationId,expectedUpdatedAt'
}
function readIntent(storageKey: string, actor: string, organizationId: string, evaluationId: string): Intent | null {
  const raw = window.localStorage.getItem(storageKey)
  if (raw === null) return null
  const value: unknown = JSON.parse(raw)
  if (!object(value) || value.version !== 1 || !uuid(value.operationId) || value.actor !== actor || value.organizationId !== organizationId || !validInput(value.input) || value.input.evaluationId !== evaluationId || Object.keys(value).some(k => !['version', 'operationId', 'actor', 'organizationId', 'input'].includes(k))) throw Error(storageMessage)
  return value as Intent
}
function parseResult(value: unknown, intent: Intent): EvaluationSaveResult {
  if (!object(value) || value.success !== true || value.operationId !== intent.operationId || value.organizationId !== intent.organizationId || value.evaluationId !== intent.input.evaluationId || !['not_received', 'canceled', 'deleted', 'superseded', 'completed'].includes(value.state as string) || Object.keys(value).some(k => !['success', 'operationId', 'organizationId', 'evaluationId', 'state', 'updatedAt'].includes(k))) throw Error('評価保存の処理結果を確認できませんでした。')
  if (value.state === 'completed') {
    if (!iso(value.updatedAt) || new Date(value.updatedAt).getTime() <= new Date(intent.input.expectedUpdatedAt).getTime()) throw Error('評価保存の処理結果を確認できませんでした。')
    return { operationId: intent.operationId, state: 'completed', updatedAt: value.updatedAt }
  }
  if (value.updatedAt !== undefined) throw Error('評価保存の処理結果を確認できませんでした。')
  return { operationId: intent.operationId, state: value.state as Exclude<EvaluationSaveResult['state'], 'completed'> }
}
const operationUrl = (intent: Intent) => '/api/hr/evaluations/' + encodeURIComponent(intent.input.evaluationId) + '/save-operations/' + encodeURIComponent(intent.operationId)

/** Persist one immutable intent per actor/organization/evaluation before any PATCH. Never retry a write automatically. */
export function useHrEvaluationSaveOperation(status: string, actor: string, organizationId: string, evaluationId: string) {
  const { request: scopedRequest } = useHrOrganizationRequest()
  const allowed = status === 'authenticated' && Boolean(actor) && Boolean(organizationId) && Boolean(evaluationId)
  const storageKey = 'hr-evaluation-save-intent:v1:' + JSON.stringify([actor, organizationId, evaluationId])
  const scope = JSON.stringify([status, actor, organizationId, evaluationId])
  const epoch = useRef({ scope, version: 0 })
  if (epoch.current.scope !== scope) epoch.current = { scope, version: epoch.current.version + 1 }
  const key = JSON.stringify([scope, epoch.current.version])
  const latest = useRef(''), mounted = useRef(false)
  type Task = { key: string; controller: AbortController }
  const task = useRef<Task | null>(null)
  const accepted = useRef<{ key: string; intent: Intent; result: EvaluationSaveResult; initial: boolean } | null>(null)
  const [busyKey, setBusyKey] = useState('')
  const [view, setView] = useState<View>({ key: '', ready: false, intent: null, result: null, message: '', loginRequired: false })
  const current = () => mounted.current && latest.current === key
  const sameIntent = (intent: Intent) => readIntent(storageKey, actor, organizationId, evaluationId)?.operationId === intent.operationId
  useLayoutEffect(() => {
    latest.current = key; mounted.current = true
    return () => { mounted.current = false; task.current?.controller.abort() }
  }, [key])
  const sync = () => {
    if (!current()) return
    if (!allowed) { setView({ key, ready: false, intent: null, result: null, message: '', loginRequired: false }); return }
    try {
      const intent = readIntent(storageKey, actor, organizationId, evaluationId)
      setView(old => ({ key, ready: true, intent, result: old.key === key && old.result?.operationId === intent?.operationId ? old.result : null,
        message: old.key === key && old.intent?.operationId === intent?.operationId ? old.message : '', loginRequired: old.key === key && old.intent?.operationId === intent?.operationId && old.loginRequired }))
    } catch { setView({ key, ready: false, intent: null, result: null, message: storageMessage, loginRequired: false }) }
  }
  useEffect(() => {
    sync()
    const changed = (event: StorageEvent) => { if (event.key === null || event.key === storageKey) sync() }
    window.addEventListener('storage', changed); window.addEventListener('focus', sync)
    return () => { window.removeEventListener('storage', changed); window.removeEventListener('focus', sync) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  const locked = async <T,>(operation: Task, action: () => T | Promise<T>): Promise<T> => {
    if (!window.navigator.locks) throw Error(storageMessage)
    return window.navigator.locks.request(storageKey, { signal: operation.controller.signal }, action)
  }
  const start = (): Task | null => {
    if (!allowed || !current() || task.current?.key === key) return null
    const operation = { key, controller: new AbortController() }
    task.current = operation; setBusyKey(key); return operation
  }
  const active = (operation: Task) => current() && task.current === operation && !operation.controller.signal.aborted
  const finish = (operation: Task) => {
    if (task.current === operation) { task.current = null; if (current()) setBusyKey('') }
  }
  const message = (text: string, loginRequired = false) => { if (current()) setView(old => ({ ...old, key, message: text, loginRequired })) }
  const accept = (intent: Intent, result: EvaluationSaveResult, initial = false) => {
    if (!current() || !sameIntent(intent)) { sync(); return }
    accepted.current = { key, intent, result, initial }
    const text = result.state === 'completed' ? '前回の保存は完了しています。現在の保存内容を確認してから続けてください。' :
      result.state === 'not_received' ? '保存の受付記録を確認できません。遅れて届く保存を防ぐため、この保存操作を終了してから現在の保存内容を確認してください。' :
      result.state === 'superseded' ? '保存後に評価が更新されています。現在の保存内容を確認してください。' :
      result.state === 'deleted' ? '対象の評価は削除されています。この操作で保存し直すことはありません。' :
      'この保存操作を終了しました。現在の保存内容を確認してから続けてください。'
    setView({ key, ready: true, intent, result, message: text, loginRequired: false })
  }
  const request = async (operation: Task, url: string, init: RequestInit) => {
    let timer: ReturnType<typeof setTimeout> | undefined
    let aborted: (() => void) | undefined
    try {
      const stopped = new Promise<never>((_, reject) => {
        aborted = () => reject(Error('操作が中断されました。'))
        operation.controller.signal.addEventListener('abort', aborted, { once: true })
        timer = setTimeout(() => operation.controller.abort(), 35000)
      })
      return await Promise.race([stopped, (async () => {
        const response = await scopedRequest(url, { ...init, cache: 'no-store', signal: operation.controller.signal })
        if (!response.body) throw Error('評価保存の応答を確認できませんでした。')
        const reader = response.body.getReader(), decoder = new TextDecoder('utf-8', { fatal: true })
        const cancel = () => { void reader.cancel().catch(() => {}) }
        operation.controller.signal.addEventListener('abort', cancel, { once: true })
        let size = 0, text = ''
        try {
          if (operation.controller.signal.aborted) throw Error('操作が中断されました。')
          while (true) {
            const chunk = await reader.read()
            if (chunk.done) break
            size += chunk.value.byteLength
            if (size > (init.method === 'PATCH' ? 4 * 1024 * 1024 : 65536)) throw Error('評価保存の応答を確認できませんでした。')
            text += decoder.decode(chunk.value, { stream: true })
          }
          text += decoder.decode()
          const data: unknown = JSON.parse(text)
          return { status: response.status, data }
        } finally {
          operation.controller.signal.removeEventListener('abort', cancel)
          void reader.cancel().catch(() => {})
        }
      })()])
    } finally {
      if (timer !== undefined) clearTimeout(timer)
      if (aborted) operation.controller.signal.removeEventListener('abort', aborted)
    }
  }
  const create = async (input: EvaluationSaveInput, payload: Record<string, unknown>): Promise<{ result: EvaluationSaveResult; acknowledgment: unknown } | null> => {
    if (!validInput(input) || input.evaluationId !== evaluationId || !object(payload) || 'expectedUpdatedAt' in payload) return null
    // Snapshot the request before waiting on the lock; the private draft never enters localStorage.
    const immutableInput = { ...input }
    const body = JSON.stringify({ ...payload, expectedUpdatedAt: immutableInput.expectedUpdatedAt })
    const operation = start(); if (!operation) return null
    let sent = false
    try {
      const intent = await locked(operation, () => {
        if (!active(operation)) throw Error('操作が中断されました。')
        if (readIntent(storageKey, actor, organizationId, evaluationId)) throw Error('前回の評価保存の結果を確認してください。')
        const operationId = window.crypto.randomUUID(); if (!uuid(operationId)) throw Error(storageMessage)
        const saved: Intent = { version: 1, actor, organizationId, operationId, input: immutableInput }
        window.localStorage.setItem(storageKey, JSON.stringify(saved))
        if (JSON.stringify(readIntent(storageKey, actor, organizationId, evaluationId)) !== JSON.stringify(saved)) throw Error(storageMessage)
        return saved
      })
      if (!active(operation)) return null
      setView({ key, ready: true, intent, result: null, message: '', loginRequired: false })
      sent = true
      const response = await request(operation, '/api/hr/evaluations/' + encodeURIComponent(evaluationId), {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', 'X-HR-Organization-Id': intent.organizationId, 'X-HR-Evaluation-Save-Operation-Id': intent.operationId, 'X-HR-Evaluation-Save-Response': 'receipt-v1' }, body,
      })
      if (!active(operation) || !sameIntent(intent)) { sync(); return null }
      if (response.status !== 200) {
        message(response.status === 401 ? 'ログインし直してから保存結果を確認してください。' : '保存結果を確認できませんでした。入力を保持したまま、下の保存操作の結果を確認してください。', response.status === 401)
        return null
      }
      if (!object(response.data) || response.data.success !== true || !object(response.data.operation) || Object.keys(response.data).some(k => !['success', 'operation', 'evaluation'].includes(k))) throw Error('保存の応答を確認できませんでした。')
      const result = parseResult({ success: true, ...response.data.operation }, intent)
      accept(intent, result, true)
      return { result, acknowledgment: response.data }
    } catch {
      if (current()) { sync(); message(sent ? '保存の応答を確認できませんでした。入力を保持したまま、下の保存操作の結果を確認してください。' : storageMessage); if (!sent) setView(old => ({ ...old, key, ready: false })) }
      return null
    } finally { finish(operation) }
  }
  const recover = async (cancel = false): Promise<EvaluationSaveResult | null> => {
    const operation = start(); if (!operation) return null
    try {
      const intent = readIntent(storageKey, actor, organizationId, evaluationId); if (!intent) { sync(); return null }
      const response = await request(operation, operationUrl(intent), { method: cancel ? 'DELETE' : 'GET', headers: { 'X-HR-Organization-Id': intent.organizationId } })
      if (!active(operation) || !sameIntent(intent)) { sync(); return null }
      if (response.status !== 200) {
        message(response.status === 401 ? 'ログインの有効期限を確認してください。保存結果は再ログイン後に確認できます。' : '評価保存の処理結果を確認できませんでした。時間をおいて再確認してください。', response.status === 401)
        return null
      }
      const result = parseResult(response.data, intent); accept(intent, result); return result
    } catch { if (current()) message('評価保存の処理結果を確認できませんでした。新しく保存せず、時間をおいて再確認してください。'); return null }
    finally { finish(operation) }
  }
  const acknowledge = async (operationId?: string, verifiedInitialVersion?: string): Promise<boolean> => {
    const confirmation = accepted.current
    if (!confirmation || confirmation.key !== key || confirmation.result.state === 'not_received' || operationId && operationId !== confirmation.intent.operationId ||
      verifiedInitialVersion !== undefined && (!confirmation.initial || confirmation.result.state !== 'completed' || confirmation.result.updatedAt !== verifiedInitialVersion)) return false
    const operation = start(); if (!operation) return false
    try {
      return await locked(operation, () => {
        if (!active(operation) || accepted.current !== confirmation || !sameIntent(confirmation.intent)) return false
        window.localStorage.removeItem(storageKey)
        if (readIntent(storageKey, actor, organizationId, evaluationId) !== null) throw Error(storageMessage)
        accepted.current = null
        setView({ key, ready: true, intent: null, result: null, message: '', loginRequired: false }); return true
      })
    } catch { if (current()) { sync(); message(storageMessage) }; return false }
    finally { finish(operation) }
  }
  const visible = view.key === key && allowed
  return { ready: visible && view.ready, intent: visible ? view.intent : null, result: visible ? view.result : null,
    message: visible ? view.message : '', loginRequired: visible && view.loginRequired, busy: busyKey === key,
    create, recover, acknowledge, isCurrent: current }
}
