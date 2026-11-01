'use client'
import { useHrOrganizationRequest } from '@/components/hr/HrOrganizationScope'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
export type EvaluationPeriodOperationInput = { periodId: string; expectedUpdatedAt: string; status: 'OPEN' | 'CLOSED' }
type Intent = { version: 1; operationId: string; actor: string; organizationId: string; input: EvaluationPeriodOperationInput }
export type EvaluationPeriodOperationResult = { operationId: string; state: 'not_received' | 'canceled' | 'deleted' | 'superseded' } | { operationId: string; state: 'completed'; updatedAt: string }
type View = { key: string; ready: boolean; intent: Intent | null; result: EvaluationPeriodOperationResult | null; message: string; loginRequired: boolean; accessDenied: boolean }
const storageMessage = '操作情報を安全に保存・確認できません。新しく変更せず、ブラウザの設定と保存内容を確認してください。'
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value)
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const iso = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(new Date(value).getTime()) && new Date(value).toISOString() === value
function validInput(value: unknown): value is EvaluationPeriodOperationInput {
  return object(value) && typeof value.periodId === 'string' && Boolean(value.periodId) && iso(value.expectedUpdatedAt) && ['OPEN', 'CLOSED'].includes(value.status as string) && Object.keys(value).sort().join(',') === 'expectedUpdatedAt,periodId,status'
}
function readIntent(storageKey: string, actor: string, organizationId: string, periodId: string): Intent | null {
  const raw = window.localStorage.getItem(storageKey)
  if (raw === null) return null
  const value: unknown = JSON.parse(raw)
  if (!object(value) || value.version !== 1 || !uuid(value.operationId) || value.actor !== actor || value.organizationId !== organizationId || !validInput(value.input) || value.input.periodId !== periodId || Object.keys(value).some(k => !['version', 'operationId', 'actor', 'organizationId', 'input'].includes(k))) throw Error(storageMessage)
  return value as Intent
}
/** A local hint only: the operation endpoint must independently authorize the actor and organization. */
export function findHrEvaluationPeriodOperationOrganization(actor: string, periodId: string): string | undefined {
  if (!actor || !periodId) return undefined
  const prefix = 'hr-evaluation-period-intent:v1:'
  let organizationId: string | undefined
  for (let index = 0; index < window.localStorage.length; index++) {
    const key = window.localStorage.key(index)
    if (!key?.startsWith(prefix)) continue
    let tuple: unknown
    try { tuple = JSON.parse(key.slice(prefix.length)) } catch { continue }
    if (!Array.isArray(tuple) || tuple.length !== 3 || tuple[0] !== actor || tuple[2] !== periodId) continue
    if (typeof tuple[1] !== 'string' || !tuple[1] || key !== prefix + JSON.stringify(tuple)) throw Error(storageMessage)
    if (!readIntent(key, actor, tuple[1], periodId)) continue
    if (organizationId !== undefined && organizationId !== tuple[1]) throw Error(storageMessage)
    organizationId = tuple[1]
  }
  return organizationId
}
function parseResult(value: unknown, intent: Intent): EvaluationPeriodOperationResult {
  if (!object(value) || value.success !== true || value.operationId !== intent.operationId || value.organizationId !== intent.organizationId || value.periodId !== intent.input.periodId || !['not_received', 'canceled', 'deleted', 'superseded', 'completed'].includes(value.state as string) || Object.keys(value).some(k => !['success', 'operationId', 'organizationId', 'periodId', 'state', 'updatedAt'].includes(k))) throw Error('評価期間の変更の処理結果を確認できませんでした。')
  if (value.state === 'completed') {
    if (!iso(value.updatedAt) || new Date(value.updatedAt).getTime() <= new Date(intent.input.expectedUpdatedAt).getTime()) throw Error('評価期間の変更の処理結果を確認できませんでした。')
    return { operationId: intent.operationId, state: 'completed', updatedAt: value.updatedAt }
  }
  if (value.updatedAt !== undefined) throw Error('評価期間の変更の処理結果を確認できませんでした。')
  return { operationId: intent.operationId, state: value.state as Exclude<EvaluationPeriodOperationResult['state'], 'completed'> }
}
const operationUrl = (intent: Intent) => '/api/hr/evaluations/periods/' + encodeURIComponent(intent.input.periodId) + '/operations/' + encodeURIComponent(intent.operationId)

/** Persist one immutable intent per actor/organization/period before any PATCH. Never retry a write automatically. */
export function useHrEvaluationPeriodOperation(status: string, actor: string, organizationId: string, periodId: string) {
  const { request: scopedRequest } = useHrOrganizationRequest()
  const allowed = status === 'authenticated' && Boolean(actor) && Boolean(organizationId) && Boolean(periodId)
  const storageKey = 'hr-evaluation-period-intent:v1:' + JSON.stringify([actor, organizationId, periodId])
  const scope = JSON.stringify([status, actor, organizationId, periodId])
  const epoch = useRef({ scope, version: 0 })
  if (epoch.current.scope !== scope) epoch.current = { scope, version: epoch.current.version + 1 }
  const key = JSON.stringify([scope, epoch.current.version])
  const latest = useRef(''), mounted = useRef(false)
  type Task = { key: string; controller: AbortController }
  const task = useRef<Task | null>(null)
  const accepted = useRef<{ key: string; intent: Intent; result: EvaluationPeriodOperationResult; initial: boolean } | null>(null)
  const [busyKey, setBusyKey] = useState('')
  const [view, setView] = useState<View>({ key: '', ready: false, intent: null, result: null, message: '', loginRequired: false, accessDenied: false })
  const current = () => mounted.current && latest.current === key
  const sameIntent = (intent: Intent) => readIntent(storageKey, actor, organizationId, periodId)?.operationId === intent.operationId
  useLayoutEffect(() => {
    latest.current = key; mounted.current = true
    return () => { mounted.current = false; task.current?.controller.abort() }
  }, [key])
  const sync = () => {
    if (!current()) return
    if (!allowed) { setView({ key, ready: false, intent: null, result: null, message: '', loginRequired: false, accessDenied: false }); return }
    try {
      const intent = readIntent(storageKey, actor, organizationId, periodId)
      setView(old => ({ key, ready: true, intent, result: old.key === key && old.result?.operationId === intent?.operationId ? old.result : null,
        message: old.key === key && old.intent?.operationId === intent?.operationId ? old.message : '', loginRequired: old.key === key && old.intent?.operationId === intent?.operationId && old.loginRequired, accessDenied: old.key === key && old.intent?.operationId === intent?.operationId && old.accessDenied }))
    } catch { setView({ key, ready: false, intent: null, result: null, message: storageMessage, loginRequired: false, accessDenied: false }) }
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
  const message = (text: string, loginRequired = false, accessDenied = false) => { if (current()) setView(old => ({ ...old, key, message: text, loginRequired, accessDenied })) }
  const accept = (intent: Intent, result: EvaluationPeriodOperationResult, initial = false) => {
    if (!current() || !sameIntent(intent)) { sync(); return }
    accepted.current = { key, intent, result, initial }
    const text = result.state === 'completed' ? '前回の変更は完了しています。現在の評価期間を確認してから続けてください。' :
      result.state === 'not_received' ? '変更の受付記録を確認できません。遅れて届く保存を防ぐため、この変更操作を終了してから現在の評価期間を確認してください。' :
      result.state === 'superseded' ? '変更後に評価期間が更新されています。現在の評価期間を確認してください。' :
      result.state === 'deleted' ? '対象の評価期間は削除されています。この操作で変更し直すことはありません。' :
      'この変更操作を終了しました。現在の評価期間を確認してから続けてください。'
    setView({ key, ready: true, intent, result, message: text, loginRequired: false, accessDenied: false })
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
        if (!response.body) throw Error('評価期間の変更の応答を確認できませんでした。')
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
            if (size > (init.method === 'PATCH' ? 4 * 1024 * 1024 : 65536)) throw Error('評価期間の変更の応答を確認できませんでした。')
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
  const create = async (input: EvaluationPeriodOperationInput): Promise<{ result: EvaluationPeriodOperationResult; acknowledgment: unknown } | null> => {
    if (!validInput(input) || input.periodId !== periodId) return null
    // Snapshot the request before waiting on the lock; only period identity, intended status and expected version enter localStorage.
    const immutableInput = { ...input }
    const body = JSON.stringify({ status: immutableInput.status, expectedUpdatedAt: immutableInput.expectedUpdatedAt })
    const operation = start(); if (!operation) return null
    let sent = false
    try {
      const intent = await locked(operation, () => {
        if (!active(operation)) throw Error('操作が中断されました。')
        if (readIntent(storageKey, actor, organizationId, periodId)) throw Error('前回の評価期間の変更の結果を確認してください。')
        const operationId = window.crypto.randomUUID(); if (!uuid(operationId)) throw Error(storageMessage)
        const saved: Intent = { version: 1, actor, organizationId, operationId, input: immutableInput }
        window.localStorage.setItem(storageKey, JSON.stringify(saved))
        if (JSON.stringify(readIntent(storageKey, actor, organizationId, periodId)) !== JSON.stringify(saved)) throw Error(storageMessage)
        return saved
      })
      if (!active(operation)) return null
      setView({ key, ready: true, intent, result: null, message: '', loginRequired: false, accessDenied: false })
      sent = true
      const response = await request(operation, '/api/hr/evaluations/periods/' + encodeURIComponent(periodId), {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', 'X-HR-Organization-Id': intent.organizationId, 'X-HR-Evaluation-Period-Operation-Id': intent.operationId }, body,
      })
      if (!active(operation) || !sameIntent(intent)) { sync(); return null }
      if (response.status !== 200) {
        message(response.status === 401 ? 'ログインし直してから変更結果を確認してください。' : response.status === 403 ? '操作時の組織または権限を確認できません。操作記録は保持しています。組織と権限を確認してから結果を再確認してください。' : response.status === 409 ? '評価期間が更新されています。変更結果を確認してから続けてください。' : '変更結果を確認できませんでした。入力を保持したまま、下の変更操作の結果を確認してください。', response.status === 401, response.status === 403)
        return null
      }
      if (!object(response.data) || response.data.success !== true || !object(response.data.operation) || Object.keys(response.data).some(k => !['success', 'operation', 'period'].includes(k))) throw Error('変更の応答を確認できませんでした。')
      const result = parseResult({ success: true, ...response.data.operation }, intent)
      accept(intent, result, true)
      return { result, acknowledgment: response.data }
    } catch {
      if (current()) { sync(); message(sent ? '変更の応答を確認できませんでした。入力を保持したまま、下の変更操作の結果を確認してください。' : storageMessage); if (!sent) setView(old => ({ ...old, key, ready: false })) }
      return null
    } finally { finish(operation) }
  }
  const recover = async (cancel = false): Promise<EvaluationPeriodOperationResult | null> => {
    const operation = start(); if (!operation) return null
    try {
      const intent = readIntent(storageKey, actor, organizationId, periodId); if (!intent) { sync(); return null }
      const response = await request(operation, operationUrl(intent), { method: cancel ? 'DELETE' : 'GET', headers: { 'X-HR-Organization-Id': intent.organizationId } })
      if (!active(operation) || !sameIntent(intent)) { sync(); return null }
      if (response.status !== 200) {
        message(response.status === 401 ? 'ログインの有効期限を確認してください。変更結果は再ログイン後に確認できます。' : response.status === 403 ? '操作時の組織または権限を確認できません。操作記録は保持しています。組織と権限を確認してから結果を再確認してください。' : '評価期間の変更の処理結果を確認できませんでした。時間をおいて再確認してください。', response.status === 401, response.status === 403)
        return null
      }
      const result = parseResult(response.data, intent); accept(intent, result); return result
    } catch { if (current()) message('評価期間の変更の処理結果を確認できませんでした。新しく変更せず、時間をおいて再確認してください。'); return null }
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
        if (readIntent(storageKey, actor, organizationId, periodId) !== null) throw Error(storageMessage)
        accepted.current = null
        setView({ key, ready: true, intent: null, result: null, message: '', loginRequired: false, accessDenied: false }); return true
      })
    } catch { if (current()) { sync(); message(storageMessage) }; return false }
    finally { finish(operation) }
  }
  const visible = view.key === key && allowed
  return { ready: visible && view.ready, intent: visible ? view.intent : null, result: visible ? view.result : null,
    message: visible ? view.message : '', loginRequired: visible && view.loginRequired, accessDenied: visible && view.accessDenied, busy: busyKey === key,
    create, recover, acknowledge, isCurrent: current }
}
