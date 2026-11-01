'use client'
import { useHrOrganizationRequest } from '@/components/hr/HrOrganizationScope'
import { hrUserMessage } from '@/lib/hr/user-message'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
type EvaluationSnapshot = { id: string; periodId: string; employeeId: string; evaluatorId: string | null; status: string; updatedAt: string }
function parseCreatedEvaluation(value: Record<string, unknown>, input: EvaluationCreationInput): EvaluationSnapshot {
  const row = value.evaluation
  if (!object(row) || Object.keys(row).sort().join(',') !== 'employeeId,evaluatorId,id,periodId,status,updatedAt' ||
    typeof row.id !== 'string' || !row.id || row.periodId !== input.periodId || row.employeeId !== input.employeeId || row.evaluatorId !== (input.evaluatorId ?? null) || row.status !== 'DRAFT' ||
    typeof row.updatedAt !== 'string' || !Number.isFinite(new Date(row.updatedAt).getTime()) || new Date(row.updatedAt).toISOString() !== row.updatedAt) throw Error('評価の作成結果を確認できませんでした。')
  return row as EvaluationSnapshot
}

export type EvaluationCreationInput = { periodId: string; employeeId: string; evaluatorId?: string | null }
type Intent = { version: 1 | 2; operationId: string; actor: string; organizationId: string; input: EvaluationCreationInput }
export type EvaluationCreationResult =
  | { operationId: string; state: 'not_received' | 'canceled' | 'deleted' }
  | { operationId: string; state: 'created'; evaluation: EvaluationSnapshot }
type View = { key: string; ready: boolean; intent: Intent | null; result: EvaluationCreationResult | null; message: string; loginRequired: boolean; accessDenied: boolean }
const storageMessage = '操作情報を安全に保存・確認できません。新しく作成せず、ブラウザの設定と評価一覧を確認してください。'
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value)
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
function validInput(value: unknown): value is EvaluationCreationInput {
  return object(value) && typeof value.periodId === 'string' && Boolean(value.periodId) && typeof value.employeeId === 'string' && Boolean(value.employeeId) &&
    (Object.keys(value).sort().join(',') === 'employeeId,periodId' || Object.keys(value).sort().join(',') === 'employeeId,evaluatorId,periodId' &&
      (value.evaluatorId === null || typeof value.evaluatorId === 'string' && Boolean(value.evaluatorId) && value.evaluatorId !== value.employeeId))
}
function readIntent(storageKey: string, actor: string, organizationId: string, periodId: string): Intent | null {
  const raw = window.localStorage.getItem(storageKey)
  if (raw === null) return null
  const value: unknown = JSON.parse(raw)
  if (!object(value) || ![1, 2].includes(value.version as number) || !uuid(value.operationId) || value.actor !== actor ||
    value.organizationId !== organizationId || !validInput(value.input) || value.input.periodId !== periodId ||
    (value.version === 1 ? 'evaluatorId' in value.input : !('evaluatorId' in value.input)) ||
    Object.keys(value).some(k => !['version', 'operationId', 'actor', 'organizationId', 'input'].includes(k))) throw Error(storageMessage)
  return value as Intent
}
/** A routing hint only; current server-side organization and admin authority remain mandatory. */
export function findHrEvaluationCreationOrganization(actor: string, periodId: string): string | undefined {
  if (!actor || !periodId) return undefined
  const prefix = 'hr-evaluation-create-intent:v1:'
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
function parseResult(value: unknown, intent: Intent): EvaluationCreationResult {
  if (!object(value) || value.success !== true || value.operationId !== intent.operationId || value.organizationId !== intent.organizationId ||
    !['not_received', 'canceled', 'deleted', 'created'].includes(value.state as string) ||
    Object.keys(value).some(k => !['success', 'operationId', 'organizationId', 'state', 'evaluation'].includes(k))) throw Error('評価の作成結果を確認できませんでした。')
  if (value.state === 'created') return { operationId: intent.operationId, state: 'created', evaluation: parseCreatedEvaluation(value, intent.input) }
  if (value.evaluation !== undefined) throw Error('評価の作成結果を確認できませんでした。')
  return { operationId: intent.operationId, state: value.state as 'not_received' | 'canceled' | 'deleted' }
}

/** Persist one immutable intent per actor/organization/period before any POST. Never retry a write automatically. */
export function useHrEvaluationCreation(status: string, actor: string, organizationId: string, periodId: string) {
  const { request: scopedRequest } = useHrOrganizationRequest()
  const allowed = status === 'authenticated' && Boolean(actor) && Boolean(organizationId) && Boolean(periodId)
  const storageKey = 'hr-evaluation-create-intent:v1:' + JSON.stringify([actor, organizationId, periodId])
  const scope = JSON.stringify([status, actor, organizationId, periodId])
  const epoch = useRef({ scope, version: 0 })
  if (epoch.current.scope !== scope) epoch.current = { scope, version: epoch.current.version + 1 }
  const key = JSON.stringify([scope, epoch.current.version])
  const latest = useRef(''), mounted = useRef(false)
  type Task = { key: string; controller: AbortController }
  const task = useRef<Task | null>(null)
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
  const accept = (intent: Intent, result: EvaluationCreationResult) => {
    if (!current() || !sameIntent(intent)) { sync(); return }
    const text = result.state === 'created' ? '評価は保存済みです。一覧を確認してから次の作成へ進んでください。' :
      result.state === 'not_received' ? '受付記録を確認できません。同じ内容で作成を再開するか、未受付の操作を終了してください。' :
      result.state === 'deleted' ? '作成済みの評価は削除されています。この操作で再作成することはありません。' :
      '未受付の操作を終了しました。新しい評価作成へ進めます。'
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
        if (!response.body) throw Error('評価の作成結果の応答を確認できませんでした。')
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
            if (size > 65536) throw Error('評価の作成結果の応答を確認できませんでした。')
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
  const send = async (operation: Task, intent: Intent): Promise<EvaluationCreationResult | null> => {
    if (!active(operation) || !sameIntent(intent)) return null
    const response = await request(operation, '/api/hr/evaluations', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-HR-Evaluation-Operation': intent.operationId, 'X-HR-Organization-Id': intent.organizationId },
      body: JSON.stringify(intent.input),
    })
    if (!active(operation) || !sameIntent(intent)) { sync(); return null }
    if (response.status !== 200) {
      message(response.status === 401 ? 'ログインの有効期限を確認してください。作成結果は再ログイン後に確認できます。' :
        response.status === 403 ? '操作時の組織または権限を確認できません。操作記録は保持しています。組織と権限を確認してから作成結果を再確認してください。' : response.status === 400 && object(response.data) && typeof response.data.error === 'string' ? hrUserMessage(response.data.error, '評価の作成結果を確認してください。作成処理は自動で再実行されません。') : '評価の作成結果を確認してください。作成処理は自動で再実行されません。', response.status === 401, response.status === 403)
      return null
    }
    const result = parseResult(response.data, intent)
    if (result.state !== 'created') throw Error('評価の作成結果を確認できませんでした。')
    accept(intent, result); return result
  }
  const create = async (input: EvaluationCreationInput): Promise<EvaluationCreationResult | null> => {
    if (!validInput(input) || input.periodId !== periodId) return null
    const immutableInput = { ...input }
    const operation = start(); if (!operation) return null
    let sent = false
    try {
      const intent = await locked(operation, () => {
        if (!active(operation)) throw Error('操作が中断されました。')
        if (readIntent(storageKey, actor, organizationId, periodId)) throw Error('前回の評価作成の結果を確認してください。')
        const operationId = window.crypto.randomUUID(); if (!uuid(operationId)) throw Error(storageMessage)
        // Keep one lock/storage namespace so old v1 pending writes still block new v2 writes.
        const saved: Intent = { version: 'evaluatorId' in immutableInput ? 2 : 1, actor, organizationId, operationId, input: immutableInput }
        window.localStorage.setItem(storageKey, JSON.stringify(saved))
        if (JSON.stringify(readIntent(storageKey, actor, organizationId, periodId)) !== JSON.stringify(saved)) throw Error(storageMessage)
        return saved
      })
      if (!active(operation)) return null
      setView({ key, ready: true, intent, result: null, message: '', loginRequired: false, accessDenied: false })
      sent = true
      return await send(operation, intent)
    } catch {
      if (current()) { sync(); message(sent ? '評価の作成結果を確認できませんでした。新しく作成せず、下の結果確認から再確認してください。' : storageMessage) }
      return null
    } finally { finish(operation) }
  }
  const recover = async (cancel = false): Promise<EvaluationCreationResult | null> => {
    const operation = start(); if (!operation) return null
    try {
      const intent = readIntent(storageKey, actor, organizationId, periodId); if (!intent) { sync(); return null }
      const response = await request(operation, '/api/hr/evaluations?format=operation&operationId=' + encodeURIComponent(intent.operationId) + '&organizationId=' + encodeURIComponent(intent.organizationId), { method: cancel ? 'DELETE' : 'GET' })
      if (!active(operation) || !sameIntent(intent)) { sync(); return null }
      if (response.status !== 200) {
        message(response.status === 401 ? 'ログインの有効期限を確認してください。作成結果は再ログイン後に確認できます。' : response.status === 403 ? '操作時の組織または権限を確認できません。操作記録は保持しています。組織と権限を確認してから作成結果を再確認してください。' : '評価の作成結果を確認できませんでした。時間をおいて再確認してください。', response.status === 401, response.status === 403)
        return null
      }
      const result = parseResult(response.data, intent); accept(intent, result); return result
    } catch { if (current()) message('評価の作成結果を確認できませんでした。新しく作成せず、時間をおいて再確認してください。'); return null }
    finally { finish(operation) }
  }
  const retry = async (): Promise<EvaluationCreationResult | null> => {
    if (view.key !== key || view.result?.state !== 'not_received' || view.accessDenied || view.loginRequired) return null
    const operation = start(); if (!operation) return null
    try {
      const intent = readIntent(storageKey, actor, organizationId, periodId)
      if (!intent || intent.operationId !== view.result.operationId) { sync(); return null }
      return await send(operation, intent)
    } catch { if (current()) message('評価の作成結果を確認できませんでした。新しく作成せず、再確認してください。'); return null }
    finally { finish(operation) }
  }
  const acknowledge = async (): Promise<boolean> => {
    if (view.key !== key || !view.result || view.result.state === 'not_received') return false
    const operation = start(); if (!operation) return false
    try {
      return await locked(operation, () => {
        if (!active(operation) || !view.intent || !sameIntent(view.intent) || view.result?.operationId !== view.intent.operationId) return false
        window.localStorage.removeItem(storageKey)
        if (readIntent(storageKey, actor, organizationId, periodId) !== null) throw Error(storageMessage)
        setView({ key, ready: true, intent: null, result: null, message: '', loginRequired: false, accessDenied: false }); return true
      })
    } catch { if (current()) { sync(); message(storageMessage) }; return false }
    finally { finish(operation) }
  }
  const visible = view.key === key && allowed
  return { ready: visible && view.ready, intent: visible ? view.intent : null, result: visible ? view.result : null,
    message: visible ? view.message : '', loginRequired: visible && view.loginRequired, accessDenied: visible && view.accessDenied, busy: busyKey === key,
    create, recover, retry, acknowledge, isCurrent: current }
}
