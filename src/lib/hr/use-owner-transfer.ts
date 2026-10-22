'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  clearOwnerTransferHandle, ownerTransferLock, ownerTransferRequest,
  ownerTransferPlanLabel,
  parseOwnerTransferCandidates, parseOwnerTransferRejection, parseOwnerTransferResult, readOwnerTransferHandle, saveOwnerTransferHandle,
  type OwnerTransferCandidate, type OwnerTransferCandidates, type OwnerTransferHandle, type OwnerTransferResult,
} from './owner-transfer-client'
import type { OwnerTransferService } from './owner-transfer/types'

type Phase = 'checking' | 'idle' | 'confirming' | 'unknown' | 'rejected' | 'missing' | 'canceled' | 'committed' | 'blocked'
type Snapshot = { phase: Phase; busy: boolean; candidates: OwnerTransferCandidates | null; handle: OwnerTransferHandle | null; result: OwnerTransferResult | null; message: string | null }
const empty = (): Snapshot => ({ phase: 'checking', busy: false, candidates: null, handle: null, result: null, message: null })
const blockedMessage = 'このブラウザでは引継ぎ状況を安全に保存できません。設定を確認してください。'
const unknownMessage = '引継ぎ結果を確認できません。同じ申請を再送信せず、状況を確認してください。'
const rejectionMessage = (code: string) => {
  if (code === 'OWNER_TRANSFER_CONFIRMATION_CHANGED' || code === 'OWNER_TRANSFER_PARTICIPANTS_CHANGED' ||
      code === 'OWNER_TRANSFER_INPUT_CONFLICT') return '確認した後任や組織の状態が変わりました。引継ぎ状況を確認し、必要なら改めて内容を確認してください。'
  if (code === 'OWNER_TRANSFER_OWNER_REQUIRED') return '現在のオーナー権限を確認できません。引継ぎ状況を確認してください。'
  if (code === 'ACCOUNT_RETIREMENT_IN_PROGRESS') return '退会処理中のため引継ぎを進められません。引継ぎ状況を確認してください。'
  return 'この引継ぎは現在進められません。引継ぎ状況を確認してください。'
}

export function useOwnerTransfer(args: {
  transport: typeof fetch;
  service: OwnerTransferService; actorId: string; organizationSlug: string; organizationId?: string
  owner: boolean; revision: string | number; active: () => boolean; onCommitted?: () => void
}) {
  const { service, actorId, organizationSlug, organizationId, owner, revision } = args
  const transportRef = useRef(args.transport); transportRef.current = args.transport
  const [state, setState] = useState<Snapshot>(empty)
  const stateRef = useRef(state); stateRef.current = state
  const activeRef = useRef(args.active); activeRef.current = args.active
  const onCommittedRef = useRef(args.onCommitted); onCommittedRef.current = args.onCommitted
  // Each mounted consumer must recheck its own current-role view once for a receipt.
  const refreshedCommitted = useRef(new Set<string>())
  const epoch = useRef(0)
  const mounted = useRef(false)
  const visible = useRef(true)
  const writable = useRef(false)
  const scope = JSON.stringify([service, actorId, organizationSlug, organizationId, revision, owner])
  const scopeRef = useRef(scope); scopeRef.current = scope
  const stateScopeRef = useRef(scope)
  // A retained DOM callback belongs to the render's lifecycle, not a later pageshow epoch.
  const handlerEpoch = epoch.current
  const current = useCallback((ticket: number) => mounted.current && visible.current && epoch.current === ticket &&
    scopeRef.current === scope && stateScopeRef.current === scope && activeRef.current(), [scope])
  const publish = useCallback((patch: Partial<Snapshot>) => {
    setState(prior => ({ ...prior, ...patch }))
  }, [])
  const refreshCommitted = useCallback((result: OwnerTransferResult) => {
    if (result.phase !== 'committed' || !onCommittedRef.current) return
    const key = JSON.stringify([result.service, result.actorId, result.organizationId, result.operationId])
    if (refreshedCommitted.current.has(key)) return
    refreshedCommitted.current.add(key)
    try { onCommittedRef.current() } catch { /* The receipt remains authoritative; the current-role read has its own retry UI. */ }
  }, [])
  const endpoint = '/api/hr/organization/transfer-owner'
  const request = (url: string, init?: RequestInit) => ownerTransferRequest(url, init, transportRef.current)
  const lockName = ownerTransferLock(service, actorId, organizationId ?? '')

  const status = useCallback(async (handle?: OwnerTransferHandle) => {
    const h = handle ?? stateRef.current.handle
    if (!h || h.actorId !== actorId || h.service !== service || !organizationId || h.organizationId !== organizationId) return
    const ticket = epoch.current
    if (!current(ticket)) return
    publish({ busy: true, phase: 'checking', handle: h, message: null })
    try {
      const query = new URLSearchParams({ action: 'status', expectedActor: actorId, orgId: h.organizationId, operationId: h.operationId })
      const response = await request(`${endpoint}?${query}`)
      if (!current(ticket)) return
      if (response.status !== 200) throw Error(unknownMessage)
      const result = parseOwnerTransferResult(response.body, h)
      writable.current = true
      refreshCommitted(result)
      publish({ phase: result.phase, result, message: result.phase === 'missing' ? 'この引継ぎはまだ登録されていません。未実行の申請を取り消すと、別の引継ぎを始められます。' : null })
    } catch { if (current(ticket)) publish({ phase: 'unknown', message: unknownMessage }) }
    finally { if (current(ticket)) publish({ busy: false }) }
  }, [actorId, service, organizationSlug, organizationId, endpoint, current, publish, refreshCommitted])

  const refreshCandidates = useCallback(async () => {
    const ticket = epoch.current
    if (!current(ticket) || !owner || !actorId || !organizationId) return
    try {
      const query = new URLSearchParams({ action: 'candidates', expectedActor: actorId, orgId: organizationId ?? '' })
      const response = await request(`${endpoint}?${query}`)
      if (!current(ticket)) return
      if (response.status !== 200) throw Error('後任候補を確認できません。')
      const candidates = parseOwnerTransferCandidates(response.body, service, actorId, organizationSlug, organizationId)
      writable.current = true
      publish({ phase: 'idle', candidates, message: null })
    } catch { if (current(ticket)) publish({ phase: 'idle', candidates: null, message: '後任候補を確認できません。再読み込みしてください。' }) }
  }, [owner, actorId, organizationSlug, organizationId, service, endpoint, current, publish])

  const moreCandidates = useCallback(async () => {
    const previous = stateRef.current.candidates
    const cursor = previous?.nextCursor
    const ticket = epoch.current
    if (!cursor || !previous || !organizationId || !owner || !current(ticket) || stateRef.current.busy) return
    publish({ busy: true })
    try {
      const query = new URLSearchParams({ action: 'candidates', expectedActor: actorId, orgId: organizationId, cursor })
      const response = await request(`${endpoint}?${query}`)
      if (!current(ticket)) return
      if (response.status !== 200) throw Error('後任候補を確認できません。')
      const page = parseOwnerTransferCandidates(response.body, service, actorId, organizationSlug, organizationId)
      if (page.owner.memberId !== previous.owner.memberId || page.organization.id !== previous.organization.id ||
          page.candidates.some(candidate => previous.candidates.some(known => known.memberId === candidate.memberId))) {
        throw Error('後任候補が更新されました。')
      }
      publish({ candidates: { ...page, candidates: [...previous.candidates, ...page.candidates] }, message: null })
    } catch { if (current(ticket)) publish({ message: '後任候補が更新されました。最初から再確認してください。' }) }
    finally { if (current(ticket)) publish({ busy: false }) }
  }, [actorId, service, organizationSlug, organizationId, endpoint, owner, current, publish])

  useEffect(() => {
    stateScopeRef.current = scope
    mounted.current = true
    visible.current = true
    writable.current = false
    ++epoch.current
    setState(empty())
    const restore = () => {
      const ticket = epoch.current
      if (!current(ticket)) return
      try {
        const handle = readOwnerTransferHandle(window.localStorage, service, actorId, organizationId ?? '')
        if (handle && organizationId && handle.organizationId !== organizationId) throw Error(blockedMessage)
        publish({ handle, phase: handle || owner ? 'checking' : 'idle' })
        if (handle) void status(handle)
        else if (owner) void refreshCandidates()
      } catch { if (current(ticket)) publish({ phase: 'blocked', message: blockedMessage }) }
    }
    restore()
    const hide = () => { visible.current = false; writable.current = false; ++epoch.current; publish({ busy: false, candidates: null, phase: 'checking' }) }
    const show = (event: PageTransitionEvent) => {
      if (event.persisted) { visible.current = true; writable.current = false; ++epoch.current; restore() }
    }
    window.addEventListener('pagehide', hide)
    window.addEventListener('pageshow', show)
    return () => { ++epoch.current; mounted.current = false; writable.current = false; window.removeEventListener('pagehide', hide); window.removeEventListener('pageshow', show) }
  }, [scope, service, actorId, organizationSlug, organizationId, owner, current, publish, status, refreshCandidates])

  const lock = useCallback(async (work: () => Promise<void>) => {
    if (!navigator.locks?.request) { publish({ phase: 'blocked', message: blockedMessage }); return }
    await navigator.locks.request(lockName, { mode: 'exclusive' }, work)
  }, [lockName, publish])

  const start = useCallback(async (candidate: OwnerTransferCandidate) => {
    const candidates = stateRef.current.candidates
    const ticket = epoch.current
    if (ticket !== handlerEpoch || !current(ticket) || !writable.current || !owner || stateRef.current.busy || stateRef.current.handle || !candidates ||
        !candidates.candidates.some(row => row.memberId === candidate.memberId && row.userId === candidate.userId &&
          row.role === candidate.role && row.plan === candidate.plan)) return
    publish({ phase: 'confirming' })
    const planLabel = ownerTransferPlanLabel(candidate.plan)
    if (!planLabel) { publish({ phase: 'idle', message: '後任のプランを確認できません。候補を再確認してください。' }); return }
    const answer = window.confirm(`${candidates.organization.name}のオーナーを${candidate.name || '選択したメンバー'}に変更します。後任の現在のプランは${planLabel}です。組織の利用上限は後任のプランに切り替わります。変更後、あなたは管理者になります。個人の有料契約は移りません。続けますか？`)
    if (!answer || !current(ticket)) { if (current(ticket)) publish({ phase: 'idle' }); return }
    publish({ busy: true, message: null })
    try {
      await lock(async () => {
        if (!current(ticket) || !writable.current) return
        const existing = readOwnerTransferHandle(window.localStorage, service, actorId, organizationId ?? '')
        if (existing) { if (current(ticket)) { publish({ handle: existing, phase: 'checking' }); void status(existing) }; return }
        const handle: OwnerTransferHandle = { version: 1, service, actorId, organizationId: candidates.organization.id,
          organizationSlug: candidates.organization.slug, operationId: crypto.randomUUID() }
        if (!current(ticket)) return
        saveOwnerTransferHandle(window.localStorage, handle)
        if (!current(ticket)) return
        publish({ handle, phase: 'unknown' })
        const input = { expectedOwnerMemberId: candidates.owner.memberId, targetMemberId: candidate.memberId,
          targetUserId: candidate.userId, targetRole: candidate.role, targetPlan: candidate.plan }
        const response = await request(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'transfer', expectedActor: actorId, orgId: handle.organizationId,
            operationId: handle.operationId, input }) })
        if (!current(ticket)) return
        if (response.status !== 200) {
          const code = parseOwnerTransferRejection(response.body, handle, response.status)
          publish({ phase: 'rejected', message: rejectionMessage(code) })
          return
        }
        const result = parseOwnerTransferResult(response.body, handle)
        if (result.phase !== 'committed' && result.phase !== 'canceled') throw Error(unknownMessage)
        refreshCommitted(result)
        publish({ phase: result.phase, result, message: null })
      })
    } catch { if (current(ticket)) publish({ phase: 'unknown', message: unknownMessage }) }
    finally { if (current(ticket)) publish({ busy: false }) }
  }, [actorId, service, organizationSlug, owner, handlerEpoch, current, publish, lock, endpoint, status, refreshCommitted])

  const cancelMissing = useCallback(async () => {
    const handle = stateRef.current.handle
    const ticket = epoch.current
    if (!handle || stateRef.current.phase !== 'missing' || ticket !== handlerEpoch || !current(ticket) || !writable.current || stateRef.current.busy) return
    publish({ busy: true })
    try {
      await lock(async () => {
        if (!current(ticket) || !writable.current) return
        const stored = readOwnerTransferHandle(window.localStorage, service, actorId, organizationId ?? '')
        if (stored?.operationId !== handle.operationId) throw Error(unknownMessage)
        const response = await request(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'cancel', expectedActor: actorId, orgId: handle.organizationId, operationId: handle.operationId }) })
        if (!current(ticket)) return
        if (response.status !== 200) throw Error(unknownMessage)
        const result = parseOwnerTransferResult(response.body, handle)
        refreshCommitted(result)
        publish({ phase: result.phase, result, message: null })
      })
    } catch { if (current(ticket)) publish({ phase: 'unknown', message: unknownMessage }) }
    finally { if (current(ticket)) publish({ busy: false }) }
  }, [actorId, service, organizationSlug, handlerEpoch, current, publish, lock, endpoint, refreshCommitted])

  const newAfterTerminal = useCallback(async () => {
    const handle = stateRef.current.handle
    const ticket = epoch.current
    if (!handle || !['canceled', 'committed'].includes(stateRef.current.phase) || !owner || ticket !== handlerEpoch || !current(ticket) || !writable.current) return
    try {
      await lock(async () => {
        if (!current(ticket) || !writable.current) return
        const query = new URLSearchParams({ action: 'candidates', expectedActor: actorId, orgId: organizationId ?? '' })
          const response = await request(`${endpoint}?${query}`)
        if (!current(ticket)) return
        if (response.status !== 200) throw Error('Current ownership was not verified')
        const candidates = parseOwnerTransferCandidates(response.body, service, actorId, organizationSlug, organizationId)
        clearOwnerTransferHandle(window.localStorage, handle)
        if (!current(ticket)) return
        publish({ handle: null, result: null, phase: 'idle', candidates, message: null })
      })
    } catch { if (current(ticket)) publish({ message: '現在のオーナー権限を確認できません。操作履歴は保持しました。' }) }
  }, [owner, handlerEpoch, current, lock, publish, organizationSlug, organizationId, endpoint, service, actorId])

  return { state: stateScopeRef.current === scope ? state : empty(), refreshCandidates, moreCandidates, start, status: () => status(), cancelMissing, newAfterTerminal }
}
