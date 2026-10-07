import { createHash } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import type { SfaContext } from './types'
import { lockSfaMutationActor, SfaMutationError } from './mutation-authority'
import { sfaOperationId, SfaReceiptRaceError } from './creation-receipt'
import { withSfaAdmission } from './limits'
import { leadId, lockLead, assertLeadVersion, nextLeadVersion } from './lead-mutation'
import { dealVersion } from './deal-mutation'
import { reserveSfaAiUsageInTransaction, completeSfaAiUsage, releaseSfaAiUsage } from './ai-limit'
import { parseLeadScoreResult, type LeadScoreResult } from './lead-score-result'

const LEASE_MS = 15 * 60 * 1000 // Exceeds the route's 300-second maximum runtime.
type Phase = 'pending' | 'complete' | 'failed' | 'cancelled'
export interface SavedLeadScore extends LeadScoreResult { id: string; leadId: string; leadName: string; sourceUpdatedAt: string; leadUpdatedAt: string }
type Receipt = { version: 1; phase: Phase; leadId: string; operationId: string; expectedUpdatedAt?: string; expiresAt?: string; reservationId?: string; result?: SavedLeadScore }
export type ScoreOperationState = { state: 'pending' | 'missing' | 'failed' | 'cancelled' | 'unavailable'; score: null } | { state: 'found'; score: SavedLeadScore }
const date = (v: unknown): v is string => typeof v === 'string' && v.length === 24 && Number.isFinite(new Date(v).getTime()) && new Date(v).toISOString() === v
const id = (v: unknown): v is string => typeof v === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(v)
export function scoreOperationInput(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new SfaMutationError(400, '入力内容が正しくありません。')
  const body = value as Record<string, unknown>
  if (Object.keys(body).some(k => !['leadId', 'operationId', 'expectedUpdatedAt'].includes(k)) || typeof body.leadId !== 'string') throw new SfaMutationError(400, 'リードの指定が正しくありません。')
  const operationId = sfaOperationId(body.operationId), expected = dealVersion(body.expectedUpdatedAt)
  if (!operationId || !expected) throw new SfaMutationError(400, '操作情報・更新日時を確認できません。画面を再読み込みしてください。')
  return { leadId: leadId(body.leadId), operationId, expectedUpdatedAt: expected.toISOString() }
}
const keyFor = (c: SfaContext, lead: string, operation: string) => 'sfa-score:v1:' + createHash('sha256').update(JSON.stringify([c.userId, c.organizationId, lead, operation])).digest('hex')
async function locked(tx: Prisma.TransactionClient, key: string, lead: string, operation: string): Promise<Receipt | null> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('sfa-score:v1'), hashtext(${key}))`
  const row = await tx.systemSetting.findUnique({ where: { key }, select: { value: true } })
  if (!row) return null
  try {
    if (row.value.length > 100000) throw new Error()
    const r = JSON.parse(row.value) as Receipt
    if (!r || r.version !== 1 || r.leadId !== lead || r.operationId !== operation || !['pending', 'complete', 'failed', 'cancelled'].includes(r.phase)) throw new Error()
    if (r.phase !== 'cancelled' && (!date(r.expectedUpdatedAt) || !date(r.expiresAt) || !id(r.reservationId))) throw new Error()
    if (r.phase === 'complete') {
      const result = r.result
      if (!result || result.id !== operation || result.leadId !== lead || typeof result.leadName !== 'string' || !result.leadName.trim() || result.leadName.length > 10000 || result.sourceUpdatedAt !== r.expectedUpdatedAt || !date(result.leadUpdatedAt) || result.leadUpdatedAt <= result.sourceUpdatedAt) throw new Error()
      parseLeadScoreResult(result)
    }
    return r
  } catch { throw new SfaMutationError(409, 'AI操作の記録を確認できません。管理者へご確認ください。') }
}
async function save(tx: Prisma.TransactionClient, key: string, receipt: Receipt, exists: boolean) {
  const data = { value: JSON.stringify(receipt) }
  if (exists) await tx.systemSetting.update({ where: { key }, data })
  else {
    try { await tx.systemSetting.create({ data: { key, ...data } }) }
    catch (error) {
      const e = error as { code?: string; meta?: { target?: unknown } }
      if (e?.code === 'P2002' && Array.isArray(e.meta?.target) && e.meta.target.length === 1 && e.meta.target[0] === 'key') throw new SfaReceiptRaceError('AI操作の競合を再確認します。')
      throw error
    }
  }
}
async function transaction<T>(c: SfaContext, work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  const result = await withSfaAdmission(c.organizationId, {}, work)
  if (result.limit) throw new Error('Unexpected score resource limit')
  return result.created
}
async function observe(tx: Prisma.TransactionClient, c: SfaContext, key: string, r: Receipt | null): Promise<ScoreOperationState> {
  if (!r) return { state: 'missing', score: null }
  if (r.phase === 'pending' && new Date(r.expiresAt!).getTime() <= Date.now()) {
    await releaseSfaAiUsage(r.reservationId!, tx)
    r = { ...r, phase: 'failed' }; await save(tx, key, r, true)
  }
  if (r.phase !== 'complete') return { state: r.phase === 'pending' ? 'pending' : r.phase, score: null }
  // Recovery exposes the saved attempt only while the owned business row is still active.
  const lead = await lockLead(tx, c, r.leadId, false)
  return lead ? { state: 'found', score: r.result! } : { state: 'unavailable', score: null }
}
export async function claimLeadScore(c: SfaContext, input: ReturnType<typeof scoreOperationInput>) {
  return transaction(c, async tx => {
    await lockSfaMutationActor(tx, c)
    const key = keyFor(c, input.leadId, input.operationId), receipt = await locked(tx, key, input.leadId, input.operationId)
    if (receipt) {
      if (receipt.phase !== 'cancelled' && receipt.expectedUpdatedAt !== input.expectedUpdatedAt) throw new SfaMutationError(409, '同じAI操作の入力が変わっています。保存結果をご確認ください。')
      return { outcome: await observe(tx, c, key, receipt) }
    }
    const lead = await lockLead(tx, c, input.leadId, false)
    if (!lead) throw new SfaMutationError(404, 'リードが見つかりません。')
    if (typeof lead.name !== 'string' || !lead.name.trim() || lead.name.length > 10000) throw new SfaMutationError(409, 'リード名を確認できません。リード名を修正してから実行してください。')
    assertLeadVersion(new Date(input.expectedUpdatedAt), lead.updatedAt)
    const quota = await reserveSfaAiUsageInTransaction(tx, c.organizationId, c.userId, 'score')
    if ('limit' in quota) return { quota }
    const created: Receipt = { version: 1, phase: 'pending', ...input, reservationId: quota.id, expiresAt: new Date(Date.now() + LEASE_MS).toISOString() }
    await save(tx, key, created, false)
    return { claimed: { lead, reservationId: quota.id } }
  })
}
/** Recovery/cancellation never invokes a provider or changes the business lead. */
export async function recoverLeadScore(c: SfaContext, lead: string, operation: string, cancel = false) {
  leadId(lead); const operationId = sfaOperationId(operation)
  if (!operationId) throw new SfaMutationError(400, '操作情報を指定してください。')
  return transaction(c, async tx => {
    await lockSfaMutationActor(tx, c)
    const key = keyFor(c, lead, operationId), receipt = await locked(tx, key, lead, operationId)
    if (!receipt && cancel) {
      await save(tx, key, { version: 1, phase: 'cancelled', leadId: lead, operationId }, false)
      return { state: 'cancelled' as const, score: null }
    }
    // A claimed provider request cannot be cancelled by closing the browser.
    return observe(tx, c, key, receipt)
  })
}
export async function settleLeadScore(c: SfaContext, input: ReturnType<typeof scoreOperationInput>, reservationId: string, value: unknown): Promise<SavedLeadScore> {
  const result = parseLeadScoreResult(value)
  return transaction(c, async tx => {
    await lockSfaMutationActor(tx, c)
    const key = keyFor(c, input.leadId, input.operationId), r = await locked(tx, key, input.leadId, input.operationId)
    if (!r || r.phase !== 'pending' || r.reservationId !== reservationId || r.expectedUpdatedAt !== input.expectedUpdatedAt || new Date(r.expiresAt!).getTime() <= Date.now()) throw new SfaMutationError(409, 'このAI操作は完了できません。保存結果をご確認ください。')
    const lead = await lockLead(tx, c, input.leadId)
    if (!lead) throw new SfaMutationError(409, 'リードが変更されています。一覧をご確認ください。')
    assertLeadVersion(new Date(input.expectedUpdatedAt), lead.updatedAt)
    const updatedAt = nextLeadVersion(lead.updatedAt)
    const updated = await tx.sfaLead.updateMany({ where: { id: lead.id, organizationId: c.organizationId, isActive: true, updatedAt: lead.updatedAt }, data: { score: result.score, updatedAt } })
    if (updated.count !== 1) throw new SfaMutationError(409, 'リードが変更されています。一覧をご確認ください。')
    await completeSfaAiUsage(reservationId, tx)
    const saved = { ...result, id: input.operationId, leadId: input.leadId, leadName: lead.name, sourceUpdatedAt: input.expectedUpdatedAt, leadUpdatedAt: updatedAt.toISOString() }
    await save(tx, key, { ...r, phase: 'complete', result: saved }, true)
    return saved
  })
}
/** Internal cleanup of our claimed attempt remains possible after actor revocation.
 * It can refund pending quota and mark failure only; it cannot change business data.
 */
export async function failLeadScore(c: SfaContext, input: ReturnType<typeof scoreOperationInput>, reservationId: string) {
  return transaction(c, async tx => {
    const key = keyFor(c, input.leadId, input.operationId), r = await locked(tx, key, input.leadId, input.operationId)
    if (!r || r.phase !== 'pending' || r.reservationId !== reservationId) return
    await releaseSfaAiUsage(reservationId, tx)
    await save(tx, key, { ...r, phase: 'failed' }, true)
  })
}
