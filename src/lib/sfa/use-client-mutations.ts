'use client'

import { useEffect, useRef, useState } from 'react'
import { useOrgSettingsGuard } from '@/lib/use-org-settings-guard'
import { OrgResponseError } from '@/lib/org-client-response'
import { activityWriteMatches, isSfaClientActivity, isSfaClientTask, sfaClientId, sfaJson, SfaClientRejection, taskWriteMatches, type SfaClientTask, isSfaClientDeal, dealWriteMatches, type SfaClientDeal } from './client-response'

type Kind = 'task' | 'activity' | 'deal'
export interface SfaPendingOperation {
  lane: string; kind: Kind; operationId?: string; targetId?: string
}
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/
const validPending = (v: unknown): v is SfaPendingOperation => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false
  const p = v as SfaPendingOperation
  return typeof p.lane === 'string' && /^[a-zA-Z0-9:_-]{1,200}$/.test(p.lane) && ['task', 'activity', 'deal'].includes(p.kind)
    && (typeof p.operationId === 'string' && UUID.test(p.operationId) && p.targetId === undefined
      || p.operationId === undefined && ['task', 'deal'].includes(p.kind) && sfaClientId(p.targetId))
}
const collection = (kind: Kind) => kind === 'task' ? '/api/sfa/tasks' : kind === 'deal' ? '/api/sfa/deals' : '/api/sfa/activities'

/** Tracks revisions, including edits made while an earlier snapshot is being saved. */
export function useSfaDraftSnapshot(value: unknown) {
  const encoded = JSON.stringify(value)
  const ref = useRef({ encoded, revision: 0 })
  if (ref.current.encoded !== encoded) ref.current = { encoded, revision: ref.current.revision + 1 }
  return ref
}

/** Unknown writes remain fenced across remount/reload. Storage contains operation metadata only. */
export function useSfaClientMutations(orgSlug: string, onRecovered: (pending: SfaPendingOperation, state: string) => void) {
  const guard = useOrgSettingsGuard(orgSlug)
  const prefix = 'doya:sfa:pending:v1:' + encodeURIComponent(guard.identity) + ':'
  const entries = useRef(new Map<string, SfaPendingOperation>())
  const scope = useRef('')
  const [view, setView] = useState<{ key: string; pending: SfaPendingOperation[]; message: string; busy: string[] }>({ key: '', pending: [], message: '', busy: [] })
  const recovered = useRef(onRecovered)
  recovered.current = onRecovered
  const running = useRef(new Set<string>())
  const message = useRef('')
  const publish = () => {
    if (guard.active()) setView({ key: guard.key, pending: [...entries.current.values()], message: message.current, busy: [...running.current] })
  }
  useEffect(() => {
    scope.current = guard.key
    entries.current = new Map()
    running.current = new Set()
    message.current = ''
    if (!guard.allowed) return
    try {
      if (sessionStorage.length > 10_000) throw new Error()
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i)
        if (!key?.startsWith(prefix)) continue
        const raw = sessionStorage.getItem(key)
        if (!raw || raw.length > 1_024) throw new Error()
        const entry: unknown = JSON.parse(raw)
        if (!validPending(entry) || key !== prefix + entry.lane || entries.current.size >= 200) throw new Error()
        entries.current.set(entry.lane, entry)
      }
    } catch { message.current = '操作記録を読み込めませんでした。このブラウザでの保存を停止しました。ブラウザの保存領域をご確認ください。'; scope.current = '' }
    publish()
    // Functions intentionally capture the actor/org/epoch of this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guard.key, guard.allowed, prefix])

  const forget = (entry: SfaPendingOperation) => {
    sessionStorage.removeItem(prefix + entry.lane)
    entries.current.delete(entry.lane)
  }
  const run = async <T,>(entry: SfaPendingOperation, work: (signal: AbortSignal) => Promise<T>): Promise<T | null> => {
    if (!guard.active() || scope.current !== guard.key || entries.current.has(entry.lane)) return null
    const operation = guard.begin(entry.lane)
    if (!operation) return null
    let persisted = false
    try {
      // Synchronous persistence and lane acquisition both precede the first network await.
      sessionStorage.setItem(prefix + entry.lane, JSON.stringify(entry))
      if (sessionStorage.getItem(prefix + entry.lane) !== JSON.stringify(entry)) throw new Error()
      persisted = true
      entries.current.set(entry.lane, entry)
      running.current.add(entry.lane)
      message.current = ''
      publish()
      const result = await work(operation.signal)
      if (!operation.current()) return null
      forget(entry)
      return result
    } catch (error) {
      if (!operation.current()) return null
      if (persisted && error instanceof SfaClientRejection) {
        try { forget(entry) } catch { /* Keep recovery available when storage cannot be cleared. */ }
        if (error.status === 401) guard.rejectAuthentication()
      }
      message.current = !persisted ? '操作記録を保存できないため、送信しませんでした。ブラウザの保存領域をご確認ください。'
        : error instanceof Error ? error.message : '保存結果を確認できませんでした。保存結果を確認してください。'
      return null
    } finally {
      if (operation.current()) { running.current.delete(entry.lane); publish() }
      operation.end()
    }
  }
  const creationBlocked = (kind: Kind) => [...entries.current.values()].some(entry => entry.operationId && entry.kind === kind)
  const create = (kind: Kind, lane: string, body: Record<string, unknown>) => {
    if (!guard.active() || creationBlocked(kind)) return Promise.resolve(null)
    let operationId: string
    try { operationId = crypto.randomUUID() } catch { message.current = '操作情報を作成できませんでした。画面を開き直してください。'; publish(); return Promise.resolve(null) }
    const entry = { lane, kind, operationId }
    return run(entry, async signal => {
      const data = await sfaJson(collection(kind), orgSlug, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, operationId }), signal })
      const row = data[kind]
      if (!(kind === 'task' ? isSfaClientTask(row) && taskWriteMatches(row, body) : kind === 'deal' ? isSfaClientDeal(row) && dealWriteMatches(row, body) : isSfaClientActivity(row) && activityWriteMatches(row, body))) throw new OrgResponseError(true, 200)
      return row
    })
  }
  const mutateTask = (task: SfaClientTask, patch: Record<string, unknown> | null) => run({ lane: 'task:' + task.id, kind: 'task', targetId: task.id }, async signal => {
    const base = '/api/sfa/tasks/' + encodeURIComponent(task.id)
    const data = await sfaJson(patch ? base : base + '?expectedUpdatedAt=' + encodeURIComponent(task.updatedAt), orgSlug, {
      method: patch ? 'PATCH' : 'DELETE', signal,
      ...(patch ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...patch, expectedUpdatedAt: task.updatedAt }) } : {}),
    })
    if (patch ? !isSfaClientTask(data.task) || !taskWriteMatches(data.task, patch, task) : data.ok !== true) throw new OrgResponseError(true, 200)
    return data
  })
  const mutateDeal = (deal: SfaClientDeal, patch: Record<string, unknown>) => run({ lane: 'deal:' + deal.id, kind: 'deal', targetId: deal.id }, async signal => {
    const data = await sfaJson('/api/sfa/deals/' + encodeURIComponent(deal.id), orgSlug, { method: 'PATCH', signal,
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...patch, expectedUpdatedAt: deal.updatedAt }) })
    if (!isSfaClientDeal(data.deal) || !dealWriteMatches(data.deal, patch, deal)) throw new OrgResponseError(true, 200)
    return data.deal
  })
  const recover = async (entry: SfaPendingOperation, cancel = false) => {
    if (!guard.active() || scope.current !== guard.key || entries.current.get(entry.lane) !== entry || running.current.has(entry.lane)) return
    const operation = guard.begin('recover:' + entry.lane)
    if (!operation) return
    running.current.add(entry.lane); publish()
    try {
      const path = entry.operationId ? collection(entry.kind) + '?operationId=' + encodeURIComponent(entry.operationId) : collection(entry.kind) + '/' + encodeURIComponent(entry.targetId!) + (entry.kind === 'deal' ? '?recovery=1' : '')
      const data = await sfaJson(path, orgSlug, { signal: operation.signal, method: cancel && entry.operationId ? 'DELETE' : 'GET' })
      if (!operation.current()) return
      const row = data[entry.kind]
      if (data.state === 'found' && (entry.kind === 'task' ? isSfaClientTask(row) && (!entry.targetId || row.id === entry.targetId) : entry.kind === 'deal' ? isSfaClientDeal(row) && (!entry.targetId || row.id === entry.targetId) : isSfaClientActivity(row))) {
        forget(entry)
        message.current = '保存済みの現在の状態を確認しました。一覧を更新しました。入力欄の内容は保持しています。同じ内容を重ねて送信しないでください。'
        recovered.current(entry, String(data.state))
      } else if (row === null && (entry.operationId ? data.state === 'cancelled' : data.state === 'missing')) {
        forget(entry)
        message.current = entry.operationId ? '未保存の操作を取り消しました。入力を確認して、改めて保存できます。' : '現在このデータは存在しません。削除した利用者や操作は特定できません。一覧を更新しました。'
        recovered.current(entry, String(data.state))
      } else if (entry.operationId && row === null && ['missing', 'unavailable'].includes(String(data.state))) {
        message.current = data.state === 'missing' ? '保存記録はまだ見つかりません。遅れて保存される可能性があるため、新しい送信は停止しています。確認を続けるか、未保存の操作を取り消してください。'
          : '保存記録はありますが、データは現在開けません。新しく作成する前に管理者へご確認ください。'
      } else throw new OrgResponseError(cancel, 200)
    } catch (error) {
      if (operation.current()) { message.current = error instanceof Error ? error.message : '結果を確認できませんでした。'; if (error instanceof SfaClientRejection && error.status === 401) guard.rejectAuthentication() }
    } finally {
      if (operation.current()) { running.current.delete(entry.lane); publish() }
      operation.end()
    }
  }
  const current: { pending: SfaPendingOperation[]; message: string; busy: string[] } = view.key === guard.key ? view : { pending: [], message: '', busy: [] }
  return { key: guard.key, identity: guard.identity, allowed: guard.allowed, active: guard.active, create, mutateTask, mutateDeal, recover,
    pending: current.pending, message: current.message, busy: current.busy, creationBlocked, blocked: (lane: string) => guard.active() && scope.current === guard.key && entries.current.has(lane), requiresLogin: guard.requiresLogin }
}
