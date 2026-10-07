'use client'
import { useEffect, useRef, useState } from 'react'
import { useOrgSettingsGuard } from '@/lib/use-org-settings-guard'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
type Pending = { version: 1; operationId: string; organizationId: string }
type Rule = { id: string; organizationId: string; name: string; workStart: string; workEnd: string; breakMinutes: number; [key: string]: unknown }
const validRule = (v: unknown, org: string): v is Rule => {
 const r = v as Rule
 return Boolean(r && typeof r === 'object' && !Array.isArray(r) && typeof r.id === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(r.id) && r.organizationId === org && typeof r.name === 'string' && r.name.trim() && r.name.length <= 120 && typeof r.workStart === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(r.workStart) && typeof r.workEnd === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(r.workEnd) && Number.isInteger(r.breakMinutes) && r.breakMinutes >= 0 && r.breakMinutes <= 1440)
}
/** Persist operation metadata before sending; never automatically repeat an unknown write. */
export function useKintaiWorkRuleCreation(org: string, ready: boolean, onRecovered: (state: string, rule: Rule | null) => void) {
 const guard = useOrgSettingsGuard(org)
 const signature = JSON.stringify([guard.key, ready])
 const epoch = useRef({ signature, version: 0 })
 if (epoch.current.signature !== signature) epoch.current = { signature, version: epoch.current.version + 1 }
 const key = JSON.stringify([signature, epoch.current.version])
 const latest = useRef(key); latest.current = key
 const storageKey = 'doya:kintai:rule-create:v1:' + encodeURIComponent(guard.identity)
 const pending = useRef<Pending | null>(null), initialized = useRef(''), running = useRef<ReturnType<typeof guard.begin>>(null)
 const recovered = useRef(onRecovered); recovered.current = onRecovered
 const [view, setView] = useState<{ key: string; pending: Pending | null; busy: boolean; blocked: boolean; message: string }>({ key: '', pending: null, busy: false, blocked: true, message: '' })
 const active = () => ready && guard.active() && latest.current === key && initialized.current === key
 const publish = (message = '', blocked = false) => { if (active()) setView({ key, pending: pending.current, busy: Boolean(running.current), blocked, message }) }
 useEffect(() => {
  initialized.current = ''; pending.current = null
  if (!ready || !guard.allowed) return
  initialized.current = key
  try {
   const raw = window.sessionStorage.getItem(storageKey)
   if (raw !== null) {
    if (raw.length > 512) throw new Error()
    const p = JSON.parse(raw) as Pending
    if (!p || typeof p !== 'object' || Array.isArray(p) || p.version !== 1 || typeof p.operationId !== 'string' || !UUID.test(p.operationId) || p.organizationId !== org) throw new Error()
    pending.current = { version: 1, operationId: p.operationId, organizationId: org }
   }
   publish(pending.current ? '保存結果を確認してください。自動で再保存は行いません。' : '')
  } catch { publish('操作記録を読み込めないため、作成を停止しました。ブラウザの保存領域をご確認ください。', true) }
  return () => { running.current?.end(); running.current = null }
  // Each effect owns its actor/org/readiness generation and storage key.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [key, ready, guard.allowed, storageKey, org])
 const forget = () => {
  window.sessionStorage.removeItem(storageKey)
  if (window.sessionStorage.getItem(storageKey) !== null) throw new Error('操作記録を消去できませんでした。保存結果を再確認してください。')
  pending.current = null
 }
 const request = async (url: string, init: RequestInit, operation: NonNullable<ReturnType<typeof guard.begin>>) => {
  const timer = setTimeout(() => operation.end(), 15_000)
  try {
   const response = await fetch(url, { ...init, cache: 'no-store', signal: operation.signal })
   const data = await response.json()
   if (!response.ok) throw new Error(typeof data?.error === 'string' ? data.error : '保存結果を確認できませんでした。')
   return data
  } finally { clearTimeout(timer) }
 }
 const create = async (input: Record<string, unknown>): Promise<Rule | null> => {
  if (!active() || pending.current || running.current || view.key !== key || view.blocked) return null
  const operation = guard.begin('work-rule-create')
  if (!operation) return null
  running.current = operation
  let sent = false
  try {
   const entry: Pending = { version: 1, operationId: crypto.randomUUID(), organizationId: org }
   if (!UUID.test(entry.operationId)) throw new Error()
   const encoded = JSON.stringify(entry)
   window.sessionStorage.setItem(storageKey, encoded)
   if (window.sessionStorage.getItem(storageKey) !== encoded) throw new Error()
   pending.current = entry; publish()
   sent = true
   const data = await request('/api/kintai/work-rules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...input, operationId: entry.operationId, organizationId: org }) }, operation)
   if (!active() || !operation.current()) return null
   if (data?.operationId !== entry.operationId || !validRule(data?.rule, org) || data.rule.name !== input.name || data.rule.workStart !== input.workStart || data.rule.workEnd !== input.workEnd || data.rule.breakMinutes !== input.breakMinutes || data.rule.overtimeCalcMethod !== input.overtimeCalcMethod || data.rule.flexEnabled !== input.flexEnabled || data.rule.coreStart !== (input.coreStart || null) || data.rule.coreEnd !== (input.coreEnd || null)) throw new Error('保存応答を確認できませんでした。保存結果をご確認ください。')
   forget(); publish('就業ルールを保存しました。'); return data.rule
  } catch {
   if (active()) publish(sent ? '保存結果を確認できませんでした。保存結果を確認してください。' : '操作記録を保存できないため送信しませんでした。ブラウザの保存領域をご確認ください。', !sent)
   return null
  } finally { if (running.current === operation) { running.current = null; if (active()) setView(v => v.key === key ? { ...v, pending: pending.current, busy: false } : v) }; operation.end() }
 }
 const recover = async (cancel = false) => {
  const entry = pending.current
  if (!active() || !entry || running.current) return
  const operation = guard.begin('work-rule-recovery')
  if (!operation) return
  running.current = operation; publish()
  try {
   const data = await request('/api/kintai/work-rules/operations/' + entry.operationId + '?organizationId=' + encodeURIComponent(org), { method: cancel ? 'DELETE' : 'GET' }, operation)
   if (!active() || !operation.current()) return
   if (data?.operationId !== entry.operationId || data?.organizationId !== org || !['found','missing','cancelled','unavailable'].includes(data?.state) || data.state === 'found' && !validRule(data.rule, org) || data.state !== 'found' && data.rule !== null || cancel && data.state === 'missing') throw new Error('保存結果の応答が正しくありません。')
   if (data.state === 'missing') { publish('保存済みの結果がまだありません。未完了の操作を取り消してから、新しく保存できます。'); return }
   forget()
   publish(data.state === 'found' ? '保存済みの就業ルールを確認しました。' : data.state === 'cancelled' ? '未完了の操作を取り消しました。遅れて届いた保存は実行されません。' : 'この操作の就業ルールは削除等により確認できません。一覧をご確認ください。')
   recovered.current(data.state, data.state === 'found' ? data.rule : null)
  } catch { if (active()) publish('保存結果を確認できませんでした。操作記録は保持しています。再度、保存結果を確認してください。') }
  finally { if (running.current === operation) { running.current = null; if (active()) setView(v => v.key === key ? { ...v, pending: pending.current, busy: false } : v) }; operation.end() }
 }
 const current = view.key === key && ready && guard.allowed
 return { create, recover, pending: current ? view.pending : null, busy: current && view.busy, blocked: !current || view.blocked || Boolean(view.pending), message: current ? view.message : '' }
}
