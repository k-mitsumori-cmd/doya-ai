'use client'
import { useHrOrganizationRequest } from '@/components/hr/HrOrganizationScope'
import { hrUserMessage } from '@/lib/hr/user-message'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
export type EvaluationAiInput = { evaluationId: string; expectedUpdatedAt: string }
type Intent = { version: 1; operationId: string; actor: string; organizationId: string; input: EvaluationAiInput }
export type EvaluationAiResult = { operationId: string; state: 'not_received' | 'processing' | 'canceled' | 'failed' | 'deleted' | 'superseded' } | { operationId: string; state: 'completed'; updatedAt: string; aiComment: string }
type View = { key: string; ready: boolean; intent: Intent | null; result: EvaluationAiResult | null; message: string; loginRequired: boolean; limit?: { canManageBilling: boolean } }
const storageMessage = '操作情報を安全に保存・確認できません。新しく生成せず、ブラウザの設定と保存内容を確認してください。'
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value)
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const iso = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(new Date(value).getTime()) && new Date(value).toISOString() === value
function validInput(value: unknown): value is EvaluationAiInput {
  return object(value) && typeof value.evaluationId === 'string' && Boolean(value.evaluationId) && iso(value.expectedUpdatedAt) && Object.keys(value).sort().join(',') === 'evaluationId,expectedUpdatedAt'
}
function readIntent(storageKey: string, actor: string, organizationId: string, evaluationId: string): Intent | null {
  const raw = window.localStorage.getItem(storageKey)
  if (raw === null) return null
  const value: unknown = JSON.parse(raw)
  if (!object(value) || value.version !== 1 || !uuid(value.operationId) || value.actor !== actor || value.organizationId !== organizationId || !validInput(value.input) || value.input.evaluationId !== evaluationId || Object.keys(value).some(k => !['version', 'operationId', 'actor', 'organizationId', 'input'].includes(k))) throw Error(storageMessage)
  return value as Intent
}
function parseResult(value: unknown, intent: Intent): EvaluationAiResult {
  if (!object(value) || value.success !== true || value.operationId !== intent.operationId || value.organizationId !== intent.organizationId || value.evaluationId !== intent.input.evaluationId || !['not_received', 'processing', 'canceled', 'failed', 'deleted', 'superseded', 'completed'].includes(value.state as string) || Object.keys(value).some(k => !['success', 'operationId', 'organizationId', 'evaluationId', 'state', 'updatedAt', 'aiComment'].includes(k))) throw Error('AIコメントの処理結果を確認できませんでした。')
  if (value.state === 'completed') {
    if (!iso(value.updatedAt) || new Date(value.updatedAt).getTime() <= new Date(intent.input.expectedUpdatedAt).getTime() || typeof value.aiComment !== 'string' || !value.aiComment.trim()) throw Error('AIコメントの処理結果を確認できませんでした。')
    return { operationId: intent.operationId, state: 'completed', updatedAt: value.updatedAt, aiComment: value.aiComment }
  }
  if (value.aiComment !== undefined || value.updatedAt !== undefined) throw Error('AIコメントの処理結果を確認できませんでした。')
  return { operationId: intent.operationId, state: value.state as Exclude<EvaluationAiResult['state'], 'completed'> }
}
const operationUrl = (intent: Intent) => '/api/hr/evaluations/' + encodeURIComponent(intent.input.evaluationId) + '/ai-comment/operations/' + encodeURIComponent(intent.operationId)

/** Persist one immutable intent per actor/organization/evaluation before any POST. Never retry a write automatically. */
export function useHrEvaluationAiOperation(status: string, actor: string, organizationId: string, evaluationId: string) {
  const { request: scopedRequest } = useHrOrganizationRequest()
  const allowed = status === 'authenticated' && Boolean(actor) && Boolean(organizationId) && Boolean(evaluationId)
  const storageKey = 'hr-evaluation-ai-intent:v1:' + JSON.stringify([actor, organizationId, evaluationId])
  const scope = JSON.stringify([status, actor, organizationId, evaluationId])
  const epoch = useRef({ scope, version: 0 })
  if (epoch.current.scope !== scope) epoch.current = { scope, version: epoch.current.version + 1 }
  const key = JSON.stringify([scope, epoch.current.version])
  const latest = useRef(''), mounted = useRef(false)
  type Task = { key: string; controller: AbortController }
  const task = useRef<Task | null>(null)
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
        message: old.key === key && old.intent?.operationId === intent?.operationId ? old.message : '', loginRequired: old.key === key && old.intent?.operationId === intent?.operationId && old.loginRequired,
        limit: old.key === key && old.intent?.operationId === intent?.operationId ? old.limit : undefined }))
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
  const accept = (intent: Intent, result: EvaluationAiResult) => {
    if (!current() || !sameIntent(intent)) { sync(); return }
    const text = result.state === 'completed' ? 'AIコメントは保存済みです。現在の保存内容を確認してから続けてください。' :
      result.state === 'not_received' ? '受付記録を確認できません。同じ内容で生成を再開するか、未受付の操作を終了してください。' :
      result.state === 'processing' ? 'AIコメントは処理中です。結果を再確認するか、この操作を終了してください。' :
      result.state === 'failed' ? '生成結果は保存されていません。この操作を確認して終了できます。' :
      result.state === 'superseded' ? '生成後に評価が更新されています。現在の保存内容を確認してください。' :
      result.state === 'deleted' ? '対象の評価は削除されています。この操作で再生成することはありません。' :
      'この生成操作を終了しました。現在の保存内容を確認してから続けてください。'
    setView(old => ({ key, ready: true, intent, result, message: text, loginRequired: false,
      limit: result.state === 'not_received' && old.key === key && old.intent?.operationId === intent.operationId ? old.limit : undefined }))
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
        if (!response.body) throw Error('AIコメントの応答を確認できませんでした。')
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
            if (size > 65536) throw Error('AIコメントの応答を確認できませんでした。')
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
  const send = async (operation: Task, intent: Intent): Promise<EvaluationAiResult | null> => {
    if (!active(operation) || !sameIntent(intent)) return null
    const response = await request(operation, operationUrl(intent), {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-HR-Organization-Id': intent.organizationId },
      body: JSON.stringify({ expectedUpdatedAt: intent.input.expectedUpdatedAt }),
    })
    if (!active(operation) || !sameIntent(intent)) { sync(); return null }
    if (response.status !== 200) {
      if (response.status === 403 && object(response.data) && response.data.code === 'HR_ORG_AI_LIMIT' && typeof response.data.canManageBilling === 'boolean') {
        const canManageBilling = response.data.canManageBilling
        setView(old => ({ ...old, key, limit: { canManageBilling }, message: 'この操作ではAIコメントを生成していません。利用枠も追加で消費していません。', loginRequired: false }))
        return null
      }
      message(response.status === 401 ? 'ログインの有効期限を確認してください。生成結果は再ログイン後に確認できます。' :
        response.status === 400 && object(response.data) && typeof response.data.error === 'string' ? hrUserMessage(response.data.error, 'AIコメントの生成結果を確認してください。生成処理は自動で再実行されません。') : 'AIコメントの生成結果を確認してください。生成処理は自動で再実行されません。', response.status === 401)
      return null
    }
    const result = parseResult(response.data, intent)
    accept(intent, result); return result
  }
  const create = async (input: EvaluationAiInput): Promise<EvaluationAiResult | null> => {
    if (!validInput(input) || input.evaluationId !== evaluationId) return null
    const operation = start(); if (!operation) return null
    let sent = false
    try {
      const intent = await locked(operation, () => {
        if (!active(operation)) throw Error('操作が中断されました。')
        if (readIntent(storageKey, actor, organizationId, evaluationId)) throw Error('前回の評価生成の結果を確認してください。')
        const operationId = window.crypto.randomUUID(); if (!uuid(operationId)) throw Error(storageMessage)
        const saved: Intent = { version: 1, actor, organizationId, operationId, input: { ...input } }
        window.localStorage.setItem(storageKey, JSON.stringify(saved))
        if (JSON.stringify(readIntent(storageKey, actor, organizationId, evaluationId)) !== JSON.stringify(saved)) throw Error(storageMessage)
        return saved
      })
      if (!active(operation)) return null
      setView({ key, ready: true, intent, result: null, message: '', loginRequired: false })
      sent = true
      return await send(operation, intent)
    } catch {
      if (current()) { sync(); message(sent ? 'AIコメントの処理結果を確認できませんでした。新しく生成せず、下の結果確認から再確認してください。' : storageMessage) }
      return null
    } finally { finish(operation) }
  }
  const recover = async (cancel = false): Promise<EvaluationAiResult | null> => {
    const operation = start(); if (!operation) return null
    try {
      const intent = readIntent(storageKey, actor, organizationId, evaluationId); if (!intent) { sync(); return null }
      const response = await request(operation, operationUrl(intent), { method: cancel ? 'DELETE' : 'GET', headers: { 'X-HR-Organization-Id': intent.organizationId } })
      if (!active(operation) || !sameIntent(intent)) { sync(); return null }
      if (response.status !== 200) {
        message(response.status === 401 ? 'ログインの有効期限を確認してください。生成結果は再ログイン後に確認できます。' : 'AIコメントの処理結果を確認できませんでした。時間をおいて再確認してください。', response.status === 401)
        return null
      }
      const result = parseResult(response.data, intent); accept(intent, result); return result
    } catch { if (current()) message('AIコメントの処理結果を確認できませんでした。新しく生成せず、時間をおいて再確認してください。'); return null }
    finally { finish(operation) }
  }
  const retry = async (): Promise<EvaluationAiResult | null> => {
    if (view.key !== key || view.result?.state !== 'not_received') return null
    const operation = start(); if (!operation) return null
    try {
      const intent = readIntent(storageKey, actor, organizationId, evaluationId)
      if (!intent || intent.operationId !== view.result.operationId) { sync(); return null }
      return await send(operation, intent)
    } catch { if (current()) message('AIコメントの処理結果を確認できませんでした。新しく生成せず、再確認してください。'); return null }
    finally { finish(operation) }
  }
  const acknowledge = async (): Promise<boolean> => {
    if (view.key !== key || !view.result || ['not_received', 'processing'].includes(view.result.state)) return false
    const operation = start(); if (!operation) return false
    try {
      return await locked(operation, () => {
        if (!active(operation) || !view.intent || !sameIntent(view.intent) || view.result?.operationId !== view.intent.operationId) return false
        window.localStorage.removeItem(storageKey)
        if (readIntent(storageKey, actor, organizationId, evaluationId) !== null) throw Error(storageMessage)
        setView({ key, ready: true, intent: null, result: null, message: '', loginRequired: false }); return true
      })
    } catch { if (current()) { sync(); message(storageMessage) }; return false }
    finally { finish(operation) }
  }
  const visible = view.key === key && allowed
  return { ready: visible && view.ready, intent: visible ? view.intent : null, result: visible ? view.result : null,
    limit: visible ? view.limit : undefined,
    message: visible ? view.message : '', loginRequired: visible && view.loginRequired, busy: busyKey === key,
    create, recover, retry, acknowledge, isCurrent: current }
}
