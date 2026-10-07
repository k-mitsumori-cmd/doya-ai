'use client'

import { useEffect, useRef, useState } from 'react'
import { useOrgSettingsGuard } from '@/lib/use-org-settings-guard'
import { OrgResponseError } from '@/lib/org-client-response'
import { activityWriteMatches, isSfaClientActivity, isSfaClientTask, sfaClientId, sfaJson, SfaClientRejection, taskWriteMatches, type SfaClientTask, isSfaClientDeal, dealWriteMatches, type SfaClientDeal, isSfaClientConversion, conversionWriteMatches, isSfaClientLead, leadWriteMatches, type SfaClientLead, isSfaClientLeadImport, isSfaClientScore, isSfaClientNextAction } from './client-response'

type Kind = 'task' | 'activity' | 'deal' | 'conversion' | 'lead' | 'import' | 'score' | 'next-action'
export interface SfaPendingOperation {
  lane: string; kind: Kind; operationId?: string; targetId?: string; leadId?: string; dealId?: string
}
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/
const validPending = (v: unknown): v is SfaPendingOperation => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false
  const p = v as SfaPendingOperation
  return typeof p.lane === 'string' && /^[a-zA-Z0-9:_-]{1,200}$/.test(p.lane) && ['task', 'activity', 'deal', 'conversion', 'lead', 'import', 'score', 'next-action'].includes(p.kind)
    && (p.kind === 'next-action' ? sfaClientId(p.dealId) && p.lane === 'next-action:' + p.dealId : p.dealId === undefined)
    && (['conversion', 'score'].includes(p.kind) ? sfaClientId(p.leadId) && p.lane === p.kind + ':' + p.leadId : p.leadId === undefined)
    && (typeof p.operationId === 'string' && UUID.test(p.operationId) && p.targetId === undefined
      || p.operationId === undefined && ['task', 'deal', 'lead'].includes(p.kind) && sfaClientId(p.targetId))
}
const collection = (kind: Exclude<Kind, 'conversion' | 'score' | 'next-action'>) => kind === 'lead' ? '/api/sfa/leads' : kind === 'import' ? '/api/sfa/leads/import' : kind === 'task' ? '/api/sfa/tasks' : kind === 'deal' ? '/api/sfa/deals' : '/api/sfa/activities'

/** Tracks revisions, including edits made while an earlier snapshot is being saved. */
export function useSfaDraftSnapshot(value: unknown) {
  const encoded = JSON.stringify(value)
  const ref = useRef({ encoded, revision: 0 })
  if (ref.current.encoded !== encoded) ref.current = { encoded, revision: ref.current.revision + 1 }
  return ref
}

/** Unknown writes remain fenced across remount/reload. Storage contains operation metadata only. */
export function useSfaClientMutations(orgSlug: string, onRecovered: (pending: SfaPendingOperation, state: string, row?: unknown) => void) {
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
  const create = (kind: Exclude<Kind, 'conversion' | 'score' | 'next-action'>, lane: string, body: Record<string, unknown>) => {
    if (!guard.active() || creationBlocked(kind)) return Promise.resolve(null)
    let operationId: string
    try { operationId = crypto.randomUUID() } catch { message.current = '操作情報を作成できませんでした。画面を開き直してください。'; publish(); return Promise.resolve(null) }
    const entry = { lane, kind, operationId }
    return run(entry, async signal => {
      const data = await sfaJson(collection(kind), orgSlug, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, operationId }), signal })
      const row = kind === 'import' ? data : data[kind]
      if (kind === 'import') {
        if (data.ok !== true || !Array.isArray(body.rows) || !isSfaClientLeadImport(row, operationId, body.rows.length)) throw new OrgResponseError(true, 200)
        return row
      }
      if (!(kind === 'lead' ? isSfaClientLead(row) && leadWriteMatches(row, body) : kind === 'task' ? isSfaClientTask(row) && taskWriteMatches(row, body) : kind === 'deal' ? isSfaClientDeal(row) && dealWriteMatches(row, body) : isSfaClientActivity(row) && activityWriteMatches(row, body))) throw new OrgResponseError(true, 200)
      return row
    })
  }
  const convertLead = (leadId: string, body: Record<string, unknown>) => {
    if (!guard.active() || !sfaClientId(leadId) || creationBlocked('conversion')) return Promise.resolve(null)
    let operationId: string
    try { operationId = crypto.randomUUID() } catch { message.current = '操作情報を作成できませんでした。画面を開き直してください。'; publish(); return Promise.resolve(null) }
    return run({ lane: 'conversion:' + leadId, kind: 'conversion', operationId, leadId }, async signal => {
      const data = await sfaJson('/api/sfa/leads/' + encodeURIComponent(leadId) + '/convert', orgSlug, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, operationId }), signal,
      })
      if (data.ok !== true || !isSfaClientConversion(data, leadId) || !conversionWriteMatches(data, body)) throw new OrgResponseError(true, 200)
      return data
    })
  }
  const scoreLead = (lead: SfaClientLead) => {
    if (!guard.active() || creationBlocked('score')) return Promise.resolve(null)
    let operationId: string
    try { operationId = crypto.randomUUID() } catch { message.current = '操作情報を作成できませんでした。画面を開き直してください。'; publish(); return Promise.resolve(null) }
    return run({ lane: 'score:' + lead.id, kind: 'score', operationId, leadId: lead.id }, async signal => {
      const data = await sfaJson('/api/sfa/ai/score', orgSlug, { method: 'POST', signal,
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ leadId: lead.id, expectedUpdatedAt: lead.updatedAt, operationId }) })
      if (data.state !== 'found' || !isSfaClientScore(data.score, lead.id, operationId) || data.score.sourceUpdatedAt !== lead.updatedAt) throw new OrgResponseError(true, 200)
      return data.score
    })
  }
  const nextAction = (deal: SfaClientDeal) => {
    if (!guard.active() || creationBlocked('next-action')) return Promise.resolve(null)
    let operationId: string
    try { operationId = crypto.randomUUID() } catch { message.current = '操作情報を作成できませんでした。画面を開き直してください。'; publish(); return Promise.resolve(null) }
    return run({ lane: 'next-action:' + deal.id, kind: 'next-action', operationId, dealId: deal.id }, async signal => {
      const data = await sfaJson('/api/sfa/ai/next-action', orgSlug, { method: 'POST', signal,
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dealId: deal.id, expectedUpdatedAt: deal.updatedAt, operationId }) })
      if (data.state !== 'found' || !isSfaClientNextAction(data.suggestion, deal.id, operationId) || data.suggestion.sourceUpdatedAt !== deal.updatedAt) throw new OrgResponseError(true, 200)
      return data.suggestion
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
  const mutateLead = (lead: SfaClientLead, patch: Record<string, unknown>) => run({ lane: 'lead:' + lead.id, kind: 'lead', targetId: lead.id }, async signal => {
    const data = await sfaJson('/api/sfa/leads/' + encodeURIComponent(lead.id), orgSlug, { method: 'PATCH', signal,
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...patch, expectedUpdatedAt: lead.updatedAt }) })
    if (!isSfaClientLead(data.lead) || !leadWriteMatches(data.lead, patch, lead)) throw new OrgResponseError(true, 200)
    return data.lead
  })
  const recover = async (entry: SfaPendingOperation, cancel = false) => {
    if (!guard.active() || scope.current !== guard.key || entries.current.get(entry.lane) !== entry || running.current.has(entry.lane)) return
    const operation = guard.begin('recover:' + entry.lane)
    if (!operation) return
    running.current.add(entry.lane); publish()
    try {
      const path = entry.kind === 'next-action' ? '/api/sfa/ai/next-action?dealId=' + encodeURIComponent(entry.dealId!) + '&operationId=' + encodeURIComponent(entry.operationId!) : entry.kind === 'score' ? '/api/sfa/ai/score?leadId=' + encodeURIComponent(entry.leadId!) + '&operationId=' + encodeURIComponent(entry.operationId!) : entry.kind === 'conversion' ? '/api/sfa/leads/' + encodeURIComponent(entry.leadId!) + '/convert?operationId=' + encodeURIComponent(entry.operationId!) : entry.operationId ? collection(entry.kind as Exclude<Kind, 'conversion' | 'score' | 'next-action'>) + '?operationId=' + encodeURIComponent(entry.operationId) : collection(entry.kind as Exclude<Kind, 'conversion' | 'score' | 'next-action'>) + '/' + encodeURIComponent(entry.targetId!) + (entry.kind === 'deal' ? '?recovery=1' : '')
      const data = await sfaJson(path, orgSlug, { signal: operation.signal, method: cancel && entry.operationId ? 'DELETE' : 'GET' })
      if (!operation.current()) return
      const row = entry.kind === 'next-action' ? data.suggestion : data[entry.kind]
      if (data.state === 'found' && (entry.kind === 'next-action' ? isSfaClientNextAction(row, entry.dealId!, entry.operationId!) : entry.kind === 'score' ? isSfaClientScore(row, entry.leadId!, entry.operationId!) : entry.kind === 'conversion' ? isSfaClientConversion(row, entry.leadId!) : entry.kind === 'import' ? isSfaClientLeadImport(row, entry.operationId!) : entry.kind === 'lead' ? isSfaClientLead(row) && (!entry.targetId || row.id === entry.targetId) : entry.kind === 'task' ? isSfaClientTask(row) && (!entry.targetId || row.id === entry.targetId) : entry.kind === 'deal' ? isSfaClientDeal(row) && (!entry.targetId || row.id === entry.targetId) : isSfaClientActivity(row))) {
        forget(entry)
        message.current = (entry.kind === 'import' && isSfaClientLeadImport(row, entry.operationId!) ? `取込記録を確認しました。${row.imported}件取込、${row.skipped}件スキップ${row.skipped ? `（データ位置: ${row.skippedRows.join('、')}）` : ''}。` : '') + '保存済みの現在の状態を確認しました。一覧を更新しました。入力欄の内容は保持しています。同じ内容を重ねて送信しないでください。'
        recovered.current(entry, String(data.state), row)
      } else if (['score', 'next-action'].includes(entry.kind) && row === null && data.state === 'failed') {
        forget(entry)
        message.current = entry.kind === 'score' ? 'このAI操作は完了していません。判定は保存されておらず、予約枠は戻しています。現在の入力を確認して、新しく実行できます。' : 'このAI操作は完了していません。提案は保存されておらず、予約枠は戻しています。現在の入力を確認して、新しく実行できます。'
        recovered.current(entry, 'failed')
      } else if (['score', 'next-action'].includes(entry.kind) && row === null && data.state === 'unavailable') {
        forget(entry)
        message.current = entry.kind === 'score' ? 'この判定の保存記録はありますが、対象のリードは現在開けません。判定は再実行していません。他のリードは引き続き利用できます。' : 'この提案の保存記録はありますが、対象の商談は現在開けません。生成は再実行していません。他の商談は引き続き利用できます。'
        recovered.current(entry, 'unavailable')
      } else if (['score', 'next-action'].includes(entry.kind) && row === null && data.state === 'pending') {
        message.current = 'AI判定・提案の完了をまだ確認できません。生成を繰り返さず、保存結果の確認を続けてください。実行中の処理はこの画面から取り消せません。'
      } else if (row === null && (entry.operationId ? data.state === 'cancelled' : data.state === 'missing')) {
        forget(entry)
        message.current = entry.operationId ? '未保存の操作を取り消しました。入力を確認して、改めて保存できます。' : '現在このデータは存在しません。削除した利用者や操作は特定できません。一覧を更新しました。'
        recovered.current(entry, String(data.state), row)
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
  return { key: guard.key, identity: guard.identity, allowed: guard.allowed, active: guard.active, create, convertLead, scoreLead, nextAction, mutateTask, mutateDeal, mutateLead, recover,
    pending: current.pending, message: current.message, busy: current.busy, creationBlocked, blocked: (lane: string) => guard.active() && scope.current === guard.key && entries.current.has(lane), requiresLogin: guard.requiresLogin }
}
