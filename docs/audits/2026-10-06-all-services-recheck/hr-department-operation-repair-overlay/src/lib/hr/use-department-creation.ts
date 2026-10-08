'use client'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { parseCreatedSettingsDepartment, type SettingsDepartment } from '@/lib/hr/department-settings-client'

export type DepartmentCreationInput = { name: string; code: string | null; sortOrder: number }
type Intent = { version: 1; operationId: string; actor: string; organizationId: string; input: DepartmentCreationInput }
export type DepartmentCreationResult =
  | { operationId: string; state: 'not_received' | 'canceled' | 'deleted' }
  | { operationId: string; state: 'created'; department: SettingsDepartment }
type View = { key: string; ready: boolean; intent: Intent | null; result: DepartmentCreationResult | null; message: string; loginRequired: boolean }
const storageMessage = '操作情報を安全に保存・確認できません。新しく作成せず、ブラウザの設定と部署一覧を確認してください。'
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value)
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
function validInput(value: unknown): value is DepartmentCreationInput {
  return object(value) && typeof value.name === 'string' && Boolean(value.name.trim()) &&
    (value.code === null || typeof value.code === 'string') && Number.isInteger(value.sortOrder) &&
    (value.sortOrder as number) >= -2147483648 && (value.sortOrder as number) <= 2147483647 &&
    Object.keys(value).every(k => ['name', 'code', 'sortOrder'].includes(k))
}
function readIntent(storageKey: string, actor: string, organizationId: string): Intent | null {
  const raw = window.localStorage.getItem(storageKey)
  if (raw === null) return null
  const value: unknown = JSON.parse(raw)
  if (!object(value) || value.version !== 1 || !uuid(value.operationId) || value.actor !== actor ||
    value.organizationId !== organizationId || !validInput(value.input) ||
    Object.keys(value).some(k => !['version', 'operationId', 'actor', 'organizationId', 'input'].includes(k))) throw Error(storageMessage)
  return value as Intent
}
function parseResult(value: unknown, intent: Intent): DepartmentCreationResult {
  if (!object(value) || value.success !== true || value.operationId !== intent.operationId || value.organizationId !== intent.organizationId ||
    !['not_received', 'canceled', 'deleted', 'created'].includes(value.state as string) ||
    Object.keys(value).some(k => !['success', 'operationId', 'organizationId', 'state', 'department'].includes(k))) throw Error('部署の作成結果を確認できませんでした。')
  if (value.state === 'created') return { operationId: intent.operationId, state: 'created', department: parseCreatedSettingsDepartment(value, intent.input) }
  if (value.department !== undefined) throw Error('部署の作成結果を確認できませんでした。')
  return { operationId: intent.operationId, state: value.state as 'not_received' | 'canceled' | 'deleted' }
}

/** Persist one immutable intent per actor/organization before any POST. Never retry a write automatically. */
export function useHrDepartmentCreation(status: string, actor: string, organizationId: string) {
  const allowed = status === 'authenticated' && Boolean(actor) && Boolean(organizationId)
  const storageKey = 'hr-department-create-intent:v1:' + JSON.stringify([actor, organizationId])
  const scope = JSON.stringify([status, actor, organizationId])
  const epoch = useRef({ scope, version: 0 })
  if (epoch.current.scope !== scope) epoch.current = { scope, version: epoch.current.version + 1 }
  const key = JSON.stringify([scope, epoch.current.version])
  const latest = useRef(''), mounted = useRef(false)
  type Task = { key: string; controller: AbortController }
  const task = useRef<Task | null>(null)
  const [busyKey, setBusyKey] = useState('')
  const [view, setView] = useState<View>({ key: '', ready: false, intent: null, result: null, message: '', loginRequired: false })
  const current = () => mounted.current && latest.current === key
  const sameIntent = (intent: Intent) => readIntent(storageKey, actor, organizationId)?.operationId === intent.operationId
  useLayoutEffect(() => {
    latest.current = key; mounted.current = true
    return () => { mounted.current = false; task.current?.controller.abort() }
  }, [key])
  const sync = () => {
    if (!current()) return
    if (!allowed) { setView({ key, ready: false, intent: null, result: null, message: '', loginRequired: false }); return }
    try {
      const intent = readIntent(storageKey, actor, organizationId)
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
  const accept = (intent: Intent, result: DepartmentCreationResult) => {
    if (!current() || !sameIntent(intent)) { sync(); return }
    const text = result.state === 'created' ? '部署は保存済みです。一覧を確認してから次の作成へ進んでください。' :
      result.state === 'not_received' ? '受付記録を確認できません。同じ内容で作成を再開するか、未受付の操作を終了してください。' :
      result.state === 'deleted' ? '作成済みの部署は削除されています。この操作で再作成することはありません。' :
      '未受付の操作を終了しました。新しい部署作成へ進めます。'
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
        const response = await fetch(url, { ...init, cache: 'no-store', signal: operation.controller.signal })
        const data: unknown = await response.json()
        return { status: response.status, data }
      })()])
    } finally {
      if (timer !== undefined) clearTimeout(timer)
      if (aborted) operation.controller.signal.removeEventListener('abort', aborted)
    }
  }
  const send = async (operation: Task, intent: Intent): Promise<DepartmentCreationResult | null> => {
    if (!active(operation) || !sameIntent(intent)) return null
    const response = await request(operation, '/api/hr/departments', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-HR-Department-Operation': intent.operationId, 'X-HR-Organization-Id': intent.organizationId },
      body: JSON.stringify(intent.input),
    })
    if (!active(operation) || !sameIntent(intent)) { sync(); return null }
    if (response.status !== 200) {
      message(response.status === 401 ? 'ログインの有効期限を確認してください。作成結果は再ログイン後に確認できます。' :
        response.status === 400 && object(response.data) && typeof response.data.error === 'string' ? response.data.error : '部署の作成結果を確認してください。作成処理は自動で再実行されません。', response.status === 401)
      return null
    }
    const result = parseResult(response.data, intent)
    if (result.state !== 'created') throw Error('部署の作成結果を確認できませんでした。')
    accept(intent, result); return result
  }
  const create = async (input: DepartmentCreationInput): Promise<DepartmentCreationResult | null> => {
    if (!validInput(input)) return null
    const operation = start(); if (!operation) return null
    let sent = false
    try {
      const intent = await locked(operation, () => {
        if (!active(operation)) throw Error('操作が中断されました。')
        if (readIntent(storageKey, actor, organizationId)) throw Error('前回の部署作成の結果を確認してください。')
        const operationId = window.crypto.randomUUID(); if (!uuid(operationId)) throw Error(storageMessage)
        const saved: Intent = { version: 1, actor, organizationId, operationId, input: { ...input } }
        window.localStorage.setItem(storageKey, JSON.stringify(saved))
        if (JSON.stringify(readIntent(storageKey, actor, organizationId)) !== JSON.stringify(saved)) throw Error(storageMessage)
        return saved
      })
      if (!active(operation)) return null
      setView({ key, ready: true, intent, result: null, message: '', loginRequired: false })
      sent = true
      return await send(operation, intent)
    } catch {
      if (current()) { sync(); message(sent ? '部署の作成結果を確認できませんでした。新しく作成せず、下の結果確認から再確認してください。' : storageMessage) }
      return null
    } finally { finish(operation) }
  }
  const recover = async (cancel = false): Promise<DepartmentCreationResult | null> => {
    const operation = start(); if (!operation) return null
    try {
      const intent = readIntent(storageKey, actor, organizationId); if (!intent) { sync(); return null }
      const response = await request(operation, '/api/hr/department-operation?operationId=' + encodeURIComponent(intent.operationId) + '&organizationId=' + encodeURIComponent(intent.organizationId), { method: cancel ? 'DELETE' : 'GET' })
      if (!active(operation) || !sameIntent(intent)) { sync(); return null }
      if (response.status !== 200) {
        message(response.status === 401 ? 'ログインの有効期限を確認してください。作成結果は再ログイン後に確認できます。' : '部署の作成結果を確認できませんでした。時間をおいて再確認してください。', response.status === 401)
        return null
      }
      const result = parseResult(response.data, intent); accept(intent, result); return result
    } catch { if (current()) message('部署の作成結果を確認できませんでした。新しく作成せず、時間をおいて再確認してください。'); return null }
    finally { finish(operation) }
  }
  const retry = async (): Promise<DepartmentCreationResult | null> => {
    if (view.key !== key || view.result?.state !== 'not_received') return null
    const operation = start(); if (!operation) return null
    try {
      const intent = readIntent(storageKey, actor, organizationId)
      if (!intent || intent.operationId !== view.result.operationId) { sync(); return null }
      return await send(operation, intent)
    } catch { if (current()) message('部署の作成結果を確認できませんでした。新しく作成せず、再確認してください。'); return null }
    finally { finish(operation) }
  }
  const acknowledge = async (): Promise<boolean> => {
    if (view.key !== key || !view.result || view.result.state === 'not_received') return false
    const operation = start(); if (!operation) return false
    try {
      return await locked(operation, () => {
        if (!active(operation) || !view.intent || !sameIntent(view.intent) || view.result?.operationId !== view.intent.operationId) return false
        window.localStorage.removeItem(storageKey)
        if (readIntent(storageKey, actor, organizationId) !== null) throw Error(storageMessage)
        setView({ key, ready: true, intent: null, result: null, message: '', loginRequired: false }); return true
      })
    } catch { if (current()) { sync(); message(storageMessage) }; return false }
    finally { finish(operation) }
  }
  const visible = view.key === key && allowed
  return { ready: visible && view.ready, intent: visible ? view.intent : null, result: visible ? view.result : null,
    message: visible ? view.message : '', loginRequired: visible && view.loginRequired, busy: busyKey === key,
    create, recover, retry, acknowledge, isCurrent: current }
}
