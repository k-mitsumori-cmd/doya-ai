'use client'
import { useHrOrganizationRequest } from '@/components/hr/HrOrganizationScope'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

export type PeriodCreationInput = { name: string; startDate: string; endDate: string }
type Intent = { version: 1; actor: string; organizationId: string; operationId: string; fingerprint: string }
type PeriodSnapshot = { id: string; organizationId: string; status: 'DRAFT'; createdAt: string; updatedAt: string }
export type PeriodCreationResult = { state: 'not_received' | 'canceled' | 'deleted'; operationId: string } | { state: 'created'; operationId: string; fingerprint: string; period: PeriodSnapshot }
type View = { key: string; ready: boolean; intent: Intent | null; result: PeriodCreationResult | null; message: string; loginRequired: boolean; accessDenied: boolean }
const storageMessage = '操作情報を安全に保存・確認できません。新しく作成せず、ブラウザの設定と評価期間一覧を確認してください。'
const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v)
const hash = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v)
const iso = (v: unknown): v is string => typeof v === 'string' && Number.isFinite(new Date(v).getTime()) && new Date(v).toISOString() === v
const prefix = 'hr-period-create-intent:v1:'
function normalize(value: PeriodCreationInput): PeriodCreationInput {
  const date = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && iso(v + 'T00:00:00.000Z')
  if (!object(value) || Object.keys(value).sort().join(',') !== 'endDate,name,startDate' || typeof value.name !== 'string' || !value.name.trim() || !date(value.startDate) || !date(value.endDate) || value.startDate > value.endDate) throw Error('期間名・開始日・終了日を確認してください。')
  return { name: value.name.trim(), startDate: value.startDate, endDate: value.endDate }
}
export async function hrPeriodCreationInputFingerprint(value: PeriodCreationInput) {
  const v = normalize(value), bytes = new TextEncoder().encode(JSON.stringify({ endDate: v.endDate + 'T00:00:00.000Z', evaluationTemplate: null, name: v.name, startDate: v.startDate + 'T00:00:00.000Z', status: 'DRAFT' }))
  return Array.from(new Uint8Array(await window.crypto.subtle.digest('SHA-256', bytes))).map(n => n.toString(16).padStart(2, '0')).join('')
}
type StoredIntent = { key: string; intent: Intent }
function ownStoredIntents(actor: string): StoredIntent[] {
  const entries: StoredIntent[] = []
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i)
    if (!key?.startsWith(prefix)) continue
    const raw = window.localStorage.getItem(key)
    if (raw === null) continue
    let tuple: unknown, value: unknown
    try { tuple = JSON.parse(key.slice(prefix.length)) } catch { tuple = undefined }
    const keyActor = Array.isArray(tuple) && typeof tuple[0] === 'string' && tuple[0] ? tuple[0] : undefined
    try { value = JSON.parse(raw) } catch {
      if (keyActor && keyActor !== actor) continue
      throw Error(storageMessage)
    }
    const payloadActor = object(value) && typeof value.actor === 'string' && value.actor ? value.actor : undefined
    if (keyActor && keyActor !== actor) {
      if (payloadActor === actor) throw Error(storageMessage)
      continue
    }
    if (keyActor !== actor && payloadActor && payloadActor !== actor) continue
    if (payloadActor !== actor || !object(value) || Object.keys(value).sort().join(',') !== 'actor,fingerprint,operationId,organizationId,version' || value.version !== 1 ||
      typeof value.organizationId !== 'string' || !value.organizationId || !uuid(value.operationId) || !hash(value.fingerprint)) throw Error(storageMessage)
    if (keyActor === actor && Array.isArray(tuple) && typeof tuple[1] === 'string' && tuple[1] !== value.organizationId) throw Error(storageMessage)
    entries.push({ key, intent: { version: 1, actor, organizationId: value.organizationId, operationId: value.operationId, fingerprint: value.fingerprint } })
  }
  return entries
}
function sameIntent(a: Intent, b: Intent) {
  return a.actor === b.actor && a.organizationId === b.organizationId && a.operationId === b.operationId && a.fingerprint === b.fingerprint && a.version === b.version
}
function readIntent(key: string, actor: string, organizationId: string): Intent | null {
  if (key !== prefix + JSON.stringify([actor, organizationId])) throw Error(storageMessage)
  const records = ownStoredIntents(actor).filter(entry => entry.intent.organizationId === organizationId)
  const first = records[0]?.intent
  if (!first) return null
  if (records.some(entry => !sameIntent(first, entry.intent))) throw Error(storageMessage)
  return first
}
/** A hint only; live server membership and organization checks remain mandatory. */
export function findHrPeriodCreationOrganization(actor: string, selectedOrganization?: string): string | undefined {
  const entries = ownStoredIntents(actor).filter(entry => selectedOrganization === undefined || entry.intent.organizationId === selectedOrganization), first = entries[0]?.intent
  if (!first) return undefined
  if (entries.some(entry => !sameIntent(first, entry.intent))) throw Error(storageMessage)
  return first.organizationId
}
/** Read-only recovery inventory. Invalid or unattributable metadata remains fail-closed. */
export function readHrPeriodCreationRecoveryCandidates(actor: string, organizationId: string) {
  if (!actor || !organizationId) throw Error(storageMessage)
  return ownStoredIntents(actor).filter(entry => entry.intent.organizationId === organizationId)
    .map(entry => ({ key: entry.key, intent: { ...entry.intent }, raw: window.localStorage.getItem(entry.key) }))
}
export function parseHrPeriodCreationRecoveryResult(value: unknown, intent: Intent): PeriodCreationResult {
  if (!object(value) || value.success !== true || value.operationId !== intent.operationId || value.organizationId !== intent.organizationId) throw Error('評価期間の作成結果を確認できませんでした。')
  if (value.state === 'created') {
    const row = value.period
    if (Object.keys(value).sort().join(',') !== 'fingerprint,operationId,organizationId,period,state,success' || value.fingerprint !== intent.fingerprint || !object(row) || Object.keys(row).sort().join(',') !== 'createdAt,id,organizationId,status,updatedAt' || typeof row.id !== 'string' || !row.id || row.organizationId !== intent.organizationId || row.status !== 'DRAFT' || !iso(row.createdAt) || !iso(row.updatedAt) || new Date(row.createdAt).getTime() > new Date(row.updatedAt).getTime()) throw Error('評価期間の作成結果を確認できませんでした。')
    return { state: 'created', operationId: intent.operationId, fingerprint: intent.fingerprint, period: row as PeriodSnapshot }
  }
  if (!['not_received', 'canceled', 'deleted'].includes(value.state as string) || Object.keys(value).sort().join(',') !== 'operationId,organizationId,state,success') throw Error('評価期間の作成結果を確認できませんでした。')
  return { state: value.state as 'not_received' | 'canceled' | 'deleted', operationId: intent.operationId }
}

/** Only identity and fingerprint are persisted. Private input stays in this mounted scope's memory. */
export function useHrPeriodCreation(status: string, actor: string, organizationId: string) {
  const { request: scopedRequest } = useHrOrganizationRequest()
  const scope = JSON.stringify([status, actor, organizationId]), epoch = useRef({ scope, version: 0 })
  if (epoch.current.scope !== scope) epoch.current = { scope, version: epoch.current.version + 1 }
  const key = JSON.stringify([scope, epoch.current.version]), storageKey = prefix + JSON.stringify([actor, organizationId])
  const allowed = status === 'authenticated' && Boolean(actor) && Boolean(organizationId), mounted = useRef('')
  type Task = { key: string; controller: AbortController }
  const task = useRef<Task | null>(null), privateInput = useRef<{ key: string; operationId: string; input: PeriodCreationInput } | null>(null)
  const [busyKey, setBusyKey] = useState(''), [view, setView] = useState<View>({ key: '', ready: false, intent: null, result: null, message: '', loginRequired: false, accessDenied: false })
  const current = () => allowed && mounted.current === key && epoch.current.scope === scope && JSON.stringify([scope, epoch.current.version]) === key
  const empty = (): View => ({ key, ready: true, intent: null, result: null, message: '', loginRequired: false, accessDenied: false })
  useLayoutEffect(() => { mounted.current = key; if (privateInput.current?.key !== key) privateInput.current = null; return () => { mounted.current = ''; task.current?.controller.abort() } }, [key])
  const sync = () => {
    if (!current()) return
    try {
      const intent = readIntent(storageKey, actor, organizationId)
      setView(old => old.key === key && JSON.stringify(old.intent) === JSON.stringify(intent) ? { ...old, ready: true, intent } : { ...empty(), intent })
    } catch { setView({ ...empty(), ready: false, message: storageMessage }) }
  }
  useEffect(() => { sync(); const changed = (event: StorageEvent) => { if (event.key === null || event.key.startsWith(prefix)) sync() }; window.addEventListener('storage', changed); window.addEventListener('focus', sync); window.addEventListener('hr-period-creation-reconciled', sync); return () => { window.removeEventListener('storage', changed); window.removeEventListener('focus', sync); window.removeEventListener('hr-period-creation-reconciled', sync) } }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  const active = (t: Task) => current() && task.current === t && !t.controller.signal.aborted
  const same = (intent: Intent) => JSON.stringify(readIntent(storageKey, actor, organizationId)) === JSON.stringify(intent)
  const start = (): Task | null => { if (!current() || task.current?.key === key) return null; const t = { key, controller: new AbortController() }; task.current = t; setBusyKey(key); return t }
  const finish = (t: Task) => { if (task.current === t) { task.current = null; if (current()) setBusyKey('') } }
  const message = (text: string, loginRequired = false, accessDenied = false) => { if (current()) setView(old => ({ ...old, key, message: text, loginRequired, accessDenied })) }
  const failure = () => { if (current()) { sync(); message('評価期間の作成結果を確認できませんでした。新しく作成せず、結果を再確認してください。') } }
  const locked = async <T,>(t: Task, fn: () => T | Promise<T>) => { if (!window.navigator.locks) throw Error(storageMessage); return window.navigator.locks.request(storageKey, { signal: t.controller.signal }, fn) }
  const request = async (t: Task, url: string, init: RequestInit) => {
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined, onAbort: (() => void) | undefined
    const timer = setTimeout(() => t.controller.abort(), 35000)
    const stopped = new Promise<never>((_, reject) => { onAbort = () => { void reader?.cancel().catch(() => {}); reject(Error('操作が中断されました。')) }; t.controller.signal.addEventListener('abort', onAbort, { once: true }) })
    try {
      if (!active(t)) throw Error('操作が中断されました。')
      return await Promise.race([stopped, (async () => {
        const response = await scopedRequest(url, { ...init, cache: 'no-store', signal: t.controller.signal })
        if (!active(t)) { void response.body?.cancel().catch(() => {}); throw Error('操作が中断されました。') }
        if (response.status === 401 || response.status === 403) { void response.body?.cancel().catch(() => {}); return { status: response.status, data: null } }
        if (!response.body) throw Error('応答がありません。')
        reader = response.body.getReader(); const decoder = new TextDecoder('utf-8', { fatal: true }); let text = '', size = 0
        while (true) { if (!active(t)) throw Error('操作が中断されました。'); const chunk = await reader.read(); if (chunk.done) break; size += chunk.value.byteLength; if (size > 65536) throw Error('応答を確認できません。'); text += decoder.decode(chunk.value, { stream: true }) }
        text += decoder.decode(); return { status: response.status, data: JSON.parse(text) as unknown }
      })()])
    } finally { clearTimeout(timer); if (onAbort) t.controller.signal.removeEventListener('abort', onAbort); void reader?.cancel().catch(() => {}) }
  }
  const accept = (intent: Intent, result: PeriodCreationResult) => {
    if (!current() || !same(intent)) { sync(); return }
    const text = result.state === 'created' ? '評価期間は保存済みです。作成した期間を確認してから次へ進んでください。' : result.state === 'not_received' ? '受付記録を確認できません。入力が残っている場合は同じ内容で作成を再開できます。新しく作成する場合は未受付の操作を終了してください。' : result.state === 'deleted' ? '作成済みの評価期間は削除されています。この操作で再作成することはありません。' : '未受付の操作を終了しました。'
    setView({ ...empty(), intent, result, message: text })
  }
  const received = (response: { status: number; data: unknown }, intent: Intent, requireCreated = false) => {
    if (response.status !== 200) { message(response.status === 401 ? 'ログインの有効期限を確認してください。再ログイン後に作成結果を確認できます。' : response.status === 403 ? '組織または権限を確認できません。操作記録は保持しています。' : '評価期間の作成結果を確認してください。自動で再実行されません。', response.status === 401, response.status === 403); return null }
    const result = parseHrPeriodCreationRecoveryResult(response.data, intent); if (requireCreated && result.state !== 'created') throw Error('作成結果を確認できません。'); accept(intent, result); return result
  }
  const send = async (t: Task, intent: Intent, input: PeriodCreationInput) => {
    if (!active(t) || !same(intent)) return null
    const response = await request(t, '/api/hr/evaluations/periods', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-HR-Organization-Id': intent.organizationId, 'X-HR-Evaluation-Period-Creation-Operation': intent.operationId }, body: JSON.stringify(input) })
    if (!active(t) || !same(intent)) { sync(); return null }
    return received(response, intent, true)
  }
  const create = async (input: PeriodCreationInput): Promise<PeriodCreationResult | null> => {
    let immutable: PeriodCreationInput
    try { immutable = normalize(input) } catch { message('期間名・開始日・終了日を確認してください。'); return null }
    const t = start(); if (!t) return null
    try {
      const fingerprint = await hrPeriodCreationInputFingerprint(immutable)
      if (!active(t)) return null
      const intent = await locked(t, () => {
        if (!active(t)) throw Error('操作が中断されました。')
        if (readIntent(storageKey, actor, organizationId)) throw Error('前回の結果を確認してください。')
        const operationId = window.crypto.randomUUID(); if (!uuid(operationId)) throw Error(storageMessage)
        const record: Intent = { version: 1, actor, organizationId, operationId, fingerprint }
        window.localStorage.setItem(storageKey, JSON.stringify(record)); if (!same(record)) throw Error(storageMessage); return record
      })
      if (!active(t)) return null
      privateInput.current = { key, operationId: intent.operationId, input: immutable }; setView({ ...empty(), intent })
      return await send(t, intent, immutable)
    } catch { failure(); return null } finally { finish(t) }
  }
  const recover = async (cancel = false): Promise<PeriodCreationResult | null> => {
    if (cancel && (view.key !== key || view.result?.state !== 'not_received' || view.loginRequired || view.accessDenied)) return null
    const t = start(); if (!t) return null
    try {
      const intent = readIntent(storageKey, actor, organizationId); if (!intent) { sync(); return null }
      const response = await request(t, '/api/hr/evaluations/periods?format=creation-operation&operationId=' + encodeURIComponent(intent.operationId) + '&organizationId=' + encodeURIComponent(intent.organizationId), { method: cancel ? 'DELETE' : 'GET', headers: { 'X-HR-Organization-Id': intent.organizationId } })
      if (!active(t) || !same(intent)) { sync(); return null }
      return received(response, intent)
    } catch { failure(); return null } finally { finish(t) }
  }
  const retry = async (): Promise<PeriodCreationResult | null> => {
    if (view.key !== key || view.result?.state !== 'not_received' || view.loginRequired || view.accessDenied) return null
    const t = start(); if (!t) return null
    try { const intent = readIntent(storageKey, actor, organizationId), draft = privateInput.current; if (!intent || view.result.operationId !== intent.operationId || draft?.key !== key || draft.operationId !== intent.operationId) return null; return await send(t, intent, draft.input) } catch { failure(); return null } finally { finish(t) }
  }
  const acknowledge = async () => {
    if (view.key !== key || !view.intent || !view.result || view.result.state === 'not_received' || view.loginRequired || view.accessDenied) return false
    const t = start(); if (!t) return false
    try { return await locked(t, () => { if (!active(t) || !view.intent || !same(view.intent) || view.result?.operationId !== view.intent.operationId) return false; const confirmed = view.intent; const entries = ownStoredIntents(actor).filter(entry => sameIntent(entry.intent, confirmed)); for (const entry of entries) window.localStorage.removeItem(entry.key); if (readIntent(storageKey, actor, organizationId) !== null) throw Error(storageMessage); privateInput.current = null; setView(empty()); return true }) } catch { failure(); return false } finally { finish(t) }
  }
  const visible = current() && view.key === key
  return { ready: visible && view.ready, intent: visible ? view.intent : null, result: visible ? view.result : null, message: visible ? view.message : '', loginRequired: visible && view.loginRequired, accessDenied: visible && view.accessDenied, busy: busyKey === key,
    canRetry: visible && privateInput.current?.key === key && privateInput.current.operationId === view.intent?.operationId, create, recover, retry, acknowledge, isCurrent: current }
}
