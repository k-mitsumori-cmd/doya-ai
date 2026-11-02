'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { CLOCK_TYPE_LABELS } from './types'
import { isKintaiClockAcknowledgement, parseKintaiClockRead, type KintaiClockRecord, type KintaiClockStatus } from './clock-response'
import { userErrorMessage } from './user-error'

type Access = { isActive: boolean | null; ready?: boolean; actorId?: string; organizationId?: string | null }
type Unconfirmed = { epoch: number; type: string; before: Set<string>; expected?: KintaiClockRecord }
const UNKNOWN = '打刻結果を確認できません。再打刻せず、現在の状態を読み直してください。'
export function useKintaiClock(access: Access) {
  const identity = JSON.stringify([access.actorId || '', access.organizationId || ''])
  const context = useRef({ identity, epoch: 0, access })
  if (context.current.identity !== identity) context.current = { identity, epoch: context.current.epoch + 1, access }
  context.current.access = access
  const mounted = useRef(false)
  const readNumber = useRef(0)
  const readController = useRef<AbortController | null>(null)
  const write = useRef<{ epoch: number } | null>(null)
  const pending = useRef<Unconfirmed | null>(null)
  const observed = useRef<{ epoch: number; ids: Set<string> } | null>(null)
  const [snapshot, setSnapshot] = useState<{ identity: string; records: KintaiClockRecord[]; status: KintaiClockStatus } | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [acting, setActing] = useState(false)
  const [unknown, setUnknown] = useState(false)
  const [lastReadOk, setLastReadOk] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const current = useCallback((epoch: number) => mounted.current && context.current.epoch === epoch, [])
  const cancelReads = useCallback(() => { readNumber.current++; readController.current?.abort() }, [])
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false; context.current.epoch++; cancelReads()
      if (successTimer.current) clearTimeout(successTimer.current)
    }
  }, [cancelReads])
  const fetchRecords = useCallback(async () => {
    if (!mounted.current || context.current.access.ready === false) return null
    const epoch = context.current.epoch, request = ++readNumber.current
    readController.current?.abort()
    const controller = new AbortController(); readController.current = controller
    const valid = () => current(epoch) && request === readNumber.current && !controller.signal.aborted
    setLoading(true); setLastReadOk(false)
    try {
      const date = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Tokyo' })
      const res = await fetch(`/api/kintai/clock?date=${date}`, { signal: controller.signal })
      const value: unknown = await res.json()
      if (!valid()) return null
      if (!res.ok) throw new Error('打刻状態を確認できません')
      const data = parseKintaiClockRead(value, date)
      observed.current = { epoch, ids: new Set([...data.records, ...data.activeShiftRecords].map(record => record.id)) }
      setSnapshot({ identity: context.current.identity, records: data.activeShiftRecords, status: data.clockStatus })
      setLoadError(false); setLastReadOk(true)
      const operation = pending.current
      if (operation?.epoch === epoch && [...data.records, ...data.activeShiftRecords].some(record => record.type === operation.type && !operation.before.has(record.id) && (!operation.expected || record.id === operation.expected.id && record.employeeId === operation.expected.employeeId && record.timestamp === operation.expected.timestamp))) {
        pending.current = null; setUnknown(false); setMessage({ type: 'success', text: '保存済みの打刻を確認しました' })
      }
      return data
    } catch {
      if (valid()) { setLoadError(true); setLastReadOk(false) }
      return null
    } finally {
      if (valid()) { setLoading(false); setHasLoaded(true) }
    }
  }, [current])
  useEffect(() => {
    // Identity changes discard the previous actor's in-flight UI state and records.
    write.current = null; pending.current = null; observed.current = null
    setUnknown(false); setActing(false); setMessage(null); setShowSuccess(false); setHasLoaded(false)
    setSnapshot(null); setLoadError(false)
    void fetchRecords()
  }, [identity, fetchRecords])
  const previousReady = useRef(access.ready)
  useEffect(() => {
    const prior = previousReady.current; previousReady.current = access.ready
    if (prior === false && access.ready !== false) void fetchRecords()
  }, [access.ready, fetchRecords])
  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => setMessage(null), 3000)
    return () => clearTimeout(timer)
  }, [message])
  const handleClock = async (type: string) => {
    const epoch = context.current.epoch
    if (!current(epoch) || context.current.access.ready === false || context.current.access.isActive !== true
      || write.current?.epoch === epoch || pending.current?.epoch === epoch || observed.current?.epoch !== epoch || loading || loadError) return
    const ticket = { epoch }; write.current = ticket
    const before = new Set(observed.current.ids)
    setActing(true); setMessage(null); setShowSuccess(false)
    if (successTimer.current) clearTimeout(successTimer.current)
    const reconcile = async () => {
      if (!current(epoch)) return
      pending.current = { epoch, type, before }; setUnknown(true); setMessage({ type: 'error', text: UNKNOWN })
      await fetchRecords()
    }
    try {
      const res = await fetch('/api/kintai/clock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type }) })
      const data: unknown = await res.json().catch(() => null)
      if (!current(epoch)) return
      if (!res.ok && res.status < 500) {
        const error = data && typeof data === 'object' && !Array.isArray(data) ? (data as { error?: unknown }).error : undefined
        setMessage({ type: 'error', text: userErrorMessage(error, '打刻できませんでした。状態を確かめて、もう一度お試しください。') })
        await fetchRecords(); return
      }
      if (!res.ok || !isKintaiClockAcknowledgement(data, type)) { await reconcile(); return }
      // A valid write receipt must also be visible in the authenticated readback.
      const operation = { epoch, type, before, expected: data.record }
      pending.current = operation
      await fetchRecords()
      if (!current(epoch)) return
      if (pending.current === operation) { setUnknown(true); setMessage({ type: 'error', text: UNKNOWN }); return }
      setMessage({ type: 'success', text: `${CLOCK_TYPE_LABELS[type] || type}しました` }); setShowSuccess(true)
      successTimer.current = setTimeout(() => { if (current(epoch)) setShowSuccess(false) }, 3000)
    } catch { await reconcile() }
    finally { if (write.current === ticket) { write.current = null; if (current(epoch)) setActing(false) } }
  }
  const resume = async () => {
    const operation = pending.current
    if (!operation || acting || loading) return
    const data = await fetchRecords()
    if (!data || !current(operation.epoch) || pending.current !== operation) return
    pending.current = null; setUnknown(false)
    setMessage({ type: 'error', text: '最新の状態を読み込みました。内容をご確認のうえ打刻してください。' })
  }
  const same = snapshot?.identity === identity
  return { status: same ? snapshot.status : 'not_clocked_in' as KintaiClockStatus, records: same ? snapshot.records : [], loading, loadError,
    hasLoaded: same && hasLoaded, acting, message, showSuccess, unknown, canResume: lastReadOk && !loading && !acting, fetchRecords, handleClock, resume }
}
