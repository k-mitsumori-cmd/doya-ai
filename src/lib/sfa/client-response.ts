import { OrgResponseError, orgErrorMessage, requestOrgJson } from '@/lib/org-client-response'
import { jstDateKey } from './task-date'
import type { ActivityType } from './types'

export interface SfaClientTask {
  id: string; title: string; status: 'open' | 'done'; dueDate: string | null
  dealId: string | null; createdAt: string; updatedAt: string; dealName?: string | null
}
export interface SfaClientActivity {
  id: string; type: ActivityType; subject: string | null; body: string | null; occurredAt: string; dealId: string | null
}
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
export const sfaClientId = (v: unknown): v is string => typeof v === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(v)
export const sfaClientDate = (v: unknown): v is string => {
  if (typeof v !== 'string' || v.length !== 24) return false
  const d = new Date(v)
  return Number.isFinite(d.getTime()) && d.toISOString() === v
}
const nullableId = (v: unknown) => v === null || sfaClientId(v)
const text = (v: unknown, max: number) => v === null || typeof v === 'string' && v.length <= max
export function isSfaClientTask(v: unknown): v is SfaClientTask {
  return record(v) && sfaClientId(v.id) && typeof v.title === 'string' && !!v.title.trim() && v.title.length <= 200
    && ['open', 'done'].includes(String(v.status)) && (v.dueDate === null || sfaClientDate(v.dueDate))
    && nullableId(v.dealId) && sfaClientDate(v.createdAt) && sfaClientDate(v.updatedAt)
    && (v.dealName === undefined || text(v.dealName, 2_000))
}
export function isSfaClientActivity(v: unknown): v is SfaClientActivity {
  return record(v) && sfaClientId(v.id) && ['call', 'meeting', 'email', 'note'].includes(String(v.type))
    && text(v.subject, 200) && text(v.body, 4_000) && sfaClientDate(v.occurredAt) && nullableId(v.dealId)
}
export class SfaClientRejection extends Error {
  constructor(readonly status: number, message: string, readonly code: string | null = null) { super(message); this.name = 'SfaClientRejection' }
}
export async function sfaJson(path: string, orgSlug: string, init: RequestInit = {}) {
  const result = await requestOrgJson('sfa', path, orgSlug, init)
  if (!result.res.ok) {
    if (result.res.status >= 500) throw new OrgResponseError(!!init.method && init.method !== 'GET', result.res.status)
    throw new SfaClientRejection(result.res.status, orgErrorMessage(result.data, result.res.status, !!init.method && init.method !== 'GET'), typeof result.data.code === 'string' && /^[A-Z0-9_]{1,80}$/.test(result.data.code) ? result.data.code : null)
  }
  if (result.data.error !== undefined || result.data.code !== undefined) throw new OrgResponseError(!!init.method && init.method !== 'GET', result.res.status)
  return result.data
}
export function taskWriteMatches(task: SfaClientTask, body: Record<string, unknown>, before?: SfaClientTask) {
  if (before && (task.id !== before.id || task.dealId !== before.dealId || task.createdAt !== before.createdAt || task.updatedAt <= before.updatedAt)) return false
  if (body.title !== undefined && task.title !== String(body.title).trim()) return false
  if (body.status !== undefined && task.status !== body.status) return false
  if (body.dealId !== undefined && task.dealId !== (body.dealId || null)) return false
  if (body.dueDate !== undefined && jstDateKey(task.dueDate) !== (body.dueDate ? jstDateKey(String(body.dueDate)) : null)) return false
  if (before) return (body.title !== undefined || task.title === before.title) && (body.status !== undefined || task.status === before.status)
    && (body.dueDate !== undefined || task.dueDate === before.dueDate)
  return task.status === 'open' && (body.dealId !== undefined || task.dealId === null) && (body.dueDate !== undefined || task.dueDate === null)
}
export function activityWriteMatches(row: SfaClientActivity, body: Record<string, unknown>) {
  return row.type === (body.type || 'note') && row.subject === (typeof body.subject === 'string' ? body.subject.trim() || null : null)
    && row.body === (typeof body.body === 'string' ? body.body.trim() || null : null)
    && row.dealId === (body.dealId || null)
}

export interface SfaClientDeal {
  id: string; name: string; amount: number; stageId: string | null; probability: number; accountId: string | null
  contactName: string | null; note: string | null; lostReason: string | null; status: 'open' | 'won' | 'lost'
  startDate: string | null; expectedCloseDate: string | null; wonAt: string | null; lostAt: string | null
  lastActivityAt: string | null; createdAt: string; updatedAt: string
}
export function isSfaClientDeal(v: unknown): v is SfaClientDeal {
  if (!record(v) || !sfaClientId(v.id) || typeof v.name !== 'string' || !v.name.trim() || v.name.length > 200
    || !Number.isSafeInteger(v.amount) || (v.amount as number) < 0 || !nullableId(v.stageId) || !nullableId(v.accountId)
    || !Number.isInteger(v.probability) || (v.probability as number) < 0 || (v.probability as number) > 100
    || !text(v.contactName, 100) || !text(v.note, 5000) || !text(v.lostReason, 300)
    || !['open', 'won', 'lost'].includes(String(v.status)) || !sfaClientDate(v.createdAt) || !sfaClientDate(v.updatedAt)
    || !['startDate', 'expectedCloseDate', 'wonAt', 'lostAt', 'lastActivityAt'].every(k => v[k] === null || sfaClientDate(v[k]))) return false
  return true
}
export function dealWriteMatches(row: SfaClientDeal, body: Record<string, unknown>, before?: SfaClientDeal) {
  if ((!before || body.stageId !== undefined) && (row.status === 'open' ? row.wonAt !== null || row.lostAt !== null : row.status === 'won' ? !row.wonAt || row.lostAt !== null : !row.lostAt || row.wonAt !== null)) return false
  if (before && (row.id !== before.id || row.createdAt !== before.createdAt || row.updatedAt <= before.updatedAt)) return false
  for (const key of ['name', 'accountId', 'contactName', 'note', 'lostReason', 'stageId'] as const) {
    if (body[key] !== undefined) {
      const value = key === 'name' || key === 'contactName' ? String(body[key] ?? '').trim() : body[key]
      if (row[key] !== (value || null)) return false
    } else if (before && row[key] !== before[key]) return false
  }
  if (body.amount !== undefined ? row.amount !== Math.round(Number(body.amount)) : before && row.amount !== before.amount) return false
  for (const key of ['startDate', 'expectedCloseDate'] as const) {
    if (body[key] !== undefined) { if (body[key] ? jstDateKey(row[key]) !== jstDateKey(String(body[key])) : row[key] !== null) return false }
    else if (before && row[key] !== before[key]) return false
  }
  if (body.stageId === undefined) {
    if (body.probability !== undefined && row.probability !== Number(body.probability)) return false
    if (before && (row.status !== before.status || row.wonAt !== before.wonAt || row.lostAt !== before.lostAt || body.probability === undefined && row.probability !== before.probability)) return false
  }
  return true
}


export interface SfaClientConversion {
  id: string; leadId: string; account: { id: string; name: string; organizationId: string; isActive: boolean; [key: string]: unknown }; deal: SfaClientDeal
}
export function isSfaClientConversion(v: unknown, leadId: string): v is SfaClientConversion {
  if (!record(v) || v.leadId !== leadId || !sfaClientId(v.id) || !record(v.account) || !isSfaClientDeal(v.deal)) return false
  const account = v.account, deal = v.deal as unknown as Record<string, unknown>
  return v.id === deal.id && sfaClientId(account.id) && deal.accountId === account.id
    && account.isActive === true && deal.isActive === true && sfaClientId(account.organizationId) && deal.organizationId === account.organizationId
    && typeof account.name === 'string' && !!account.name.trim() && account.name.length <= 200
    && [['corporateNumber', 20], ['industry', 80], ['prefecture', 40], ['url', 300], ['note', 2000]].every(([key, max]) => text(account[String(key)], Number(max)))
    && sfaClientDate(account.createdAt) && sfaClientDate(account.updatedAt)
}
export function conversionWriteMatches(row: SfaClientConversion, body: Record<string, unknown>) {
  if (!dealWriteMatches(row.deal, { name: body.dealName, amount: body.amount })) return false
  for (const key of ['accountName', 'corporateNumber', 'industry', 'prefecture', 'url', 'note']) {
    if (body[key] === undefined) continue
    const expected = typeof body[key] === 'string' ? body[key].trim() || null : null
    if (row.account[key === 'accountName' ? 'name' : key] !== expected) return false
  }
  return true
}

export interface SfaClientLead {
  id: string; name: string; corporateNumber: string | null; contactName: string | null; email: string | null
  phone: string | null; note: string | null; source: string; status: string; score: number | null
  convertedAccountId: string | null; updatedAt: string
}
/** Legacy values stay visible for review; writes enforce the current, tighter field limits. */
export function isSfaClientLead(v: unknown): v is SfaClientLead {
  return record(v) && sfaClientId(v.id) && typeof v.name === 'string' && !!v.name.trim() && v.name.length <= 10000
    && typeof v.source === 'string' && v.source.length <= 100 && ['new', 'working', 'nurturing', 'qualified', 'converted', 'disqualified'].includes(String(v.status))
    && ['corporateNumber', 'contactName', 'email', 'phone', 'note'].every(k => text(v[k], 10000))
    && nullableId(v.convertedAccountId) && sfaClientDate(v.updatedAt)
    && (v.score === null || Number.isInteger(v.score) && (v.score as number) >= 0 && (v.score as number) <= 100)
}
export function leadWriteMatches(row: SfaClientLead, body: Record<string, unknown>, before?: SfaClientLead) {
  if (before && (row.id !== before.id || row.updatedAt <= before.updatedAt || row.name !== before.name || row.source !== before.source || row.corporateNumber !== before.corporateNumber || row.convertedAccountId !== before.convertedAccountId)) return false
  for (const k of ['contactName', 'email', 'phone', 'note'] as const) {
    if (body[k] !== undefined ? row[k] !== (body[k] || null) : row[k] !== (before ? before[k] : null)) return false
  }
  if (before) return row.status === (body.status ?? before.status) && row.score === (body.score === undefined ? before.score : body.score === null ? null : Math.round(Number(body.score)))
  return row.name === String(body.name).trim() && row.source === (body.source || 'manual') && row.corporateNumber === (body.corporateNumber || null)
    && row.status === 'new' && row.score === null && row.convertedAccountId === null
}
export interface SfaClientLeadImport { id: string; imported: number; skipped: number; skippedRows: number[] }
export function isSfaClientLeadImport(v: unknown, operationId: string, rowCount?: number): v is SfaClientLeadImport {
  if (!record(v) || v.id !== operationId || !Number.isInteger(v.imported) || (v.imported as number) < 1 || !Number.isInteger(v.skipped) || (v.skipped as number) < 0) return false
  const total = (v.imported as number) + (v.skipped as number)
  return total <= 500 && (rowCount === undefined || rowCount === total) && Array.isArray(v.skippedRows) && v.skippedRows.length === v.skipped
    && new Set(v.skippedRows).size === v.skippedRows.length && v.skippedRows.every(n => Number.isInteger(n) && n >= 1 && n <= total)
}

export interface SfaClientScore {
  id: string; leadId: string; leadName: string; score: number; reason: string; nextAction: string; sourceUpdatedAt: string; leadUpdatedAt: string
}
export function isSfaClientScore(v: unknown, leadId: string, operationId: string): v is SfaClientScore {
  return record(v) && v.id === operationId && v.leadId === leadId && typeof v.leadName === 'string' && !!v.leadName.trim() && v.leadName.length <= 10000 && Number.isInteger(v.score) && (v.score as number) >= 0 && (v.score as number) <= 100
    && typeof v.reason === 'string' && !!v.reason.trim() && v.reason.length <= 2000
    && typeof v.nextAction === 'string' && !!v.nextAction.trim() && v.nextAction.length <= 2000
    && sfaClientDate(v.sourceUpdatedAt) && sfaClientDate(v.leadUpdatedAt) && v.leadUpdatedAt > v.sourceUpdatedAt
}
