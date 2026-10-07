import { createHash } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import type { SfaContext } from './types'
import { lockSfaMutationActor, SfaMutationError } from './mutation-authority'
import { sfaOperationId, SfaReceiptRaceError } from './creation-receipt'
import { withSfaAdmission } from './limits'
import { lockDeal, dealVersion } from './deal-mutation'
import { reserveSfaAiUsageInTransaction, completeSfaAiUsage, releaseSfaAiUsage } from './ai-limit'
import { parseNextActionResult, type NextActionInput, type NextActionResult } from './ai'
import { ACTIVITY_TYPE_LABEL } from './constants'
import type { ActivityType } from './types'

const LEASE_MS = 15 * 60 * 1000
const date = (v: unknown): v is string => typeof v === 'string' && v.length === 24 && Number.isFinite(new Date(v).getTime()) && new Date(v).toISOString() === v
const id = (v: unknown): v is string => typeof v === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(v)
const day = (v: string) => new Date(new Date(v).getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
export interface SavedNextAction extends NextActionResult { id: string; dealId: string; dealName: string; sourceUpdatedAt: string; startedAt: string }
type Receipt = { version: 1; phase: 'pending' | 'complete' | 'failed' | 'cancelled'; dealId: string; operationId: string; expectedUpdatedAt?: string; startedAt?: string; expiresAt?: string; reservationId?: string; result?: SavedNextAction }
export type NextActionOperationState = { state: 'pending' | 'missing' | 'failed' | 'cancelled' | 'unavailable'; suggestion: null } | { state: 'found'; suggestion: SavedNextAction }
export function nextActionOperationInput(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new SfaMutationError(400, '入力内容が正しくありません。')
  const body = value as Record<string, unknown>
  if (Object.keys(body).some(k => !['dealId', 'operationId', 'expectedUpdatedAt'].includes(k)) || !id(body.dealId)) throw new SfaMutationError(400, '商談の指定が正しくありません。')
  const operationId = sfaOperationId(body.operationId), expected = dealVersion(body.expectedUpdatedAt)
  if (!operationId || !expected) throw new SfaMutationError(400, '操作情報・更新日時を確認できません。画面を再読み込みしてください。')
  return { dealId: body.dealId, operationId, expectedUpdatedAt: expected.toISOString() }
}
const keyFor = (c: SfaContext, deal: string, operation: string) => 'sfa-next-action:v1:' + createHash('sha256').update(JSON.stringify([c.userId, c.organizationId, deal, operation])).digest('hex')
async function locked(tx: Prisma.TransactionClient, key: string, deal: string, operation: string): Promise<Receipt | null> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('sfa-next-action:v1'), hashtext(${key}))`
  const row = await tx.systemSetting.findUnique({ where: { key }, select: { value: true } })
  if (!row) return null
  try {
    if (row.value.length > 100000) throw new Error()
    const r = JSON.parse(row.value) as Receipt
    if (!r || r.version !== 1 || r.dealId !== deal || r.operationId !== operation || !['pending', 'complete', 'failed', 'cancelled'].includes(r.phase)) throw new Error()
    if (r.phase !== 'cancelled' && (!date(r.expectedUpdatedAt) || !date(r.startedAt) || !date(r.expiresAt) || !id(r.reservationId))) throw new Error()
    if (r.phase === 'complete') {
      const v = r.result
      if (!v || v.id !== operation || v.dealId !== deal || typeof v.dealName !== 'string' || !v.dealName.trim() || v.dealName.length > 10000 || v.sourceUpdatedAt !== r.expectedUpdatedAt || v.startedAt !== r.startedAt) throw new Error()
      parseNextActionResult(v, day(v.startedAt))
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
  if (result.limit) throw new Error('Unexpected next-action resource limit')
  return result.created
}
async function observe(tx: Prisma.TransactionClient, c: SfaContext, key: string, r: Receipt | null): Promise<NextActionOperationState> {
  if (!r) return { state: 'missing', suggestion: null }
  if (r.phase === 'pending' && new Date(r.expiresAt!).getTime() <= Date.now()) {
    await releaseSfaAiUsage(r.reservationId!, tx)
    r = { ...r, phase: 'failed' }; await save(tx, key, r, true)
  }
  if (r.phase !== 'complete') return { state: r.phase, suggestion: null }
  const deal = await lockDeal(tx, c, r.dealId, false)
  return deal ? { state: 'found', suggestion: r.result! } : { state: 'unavailable', suggestion: null }
}
export async function claimNextAction(c: SfaContext, input: ReturnType<typeof nextActionOperationInput>) {
  return transaction(c, async tx => {
    await lockSfaMutationActor(tx, c)
    const key = keyFor(c, input.dealId, input.operationId), receipt = await locked(tx, key, input.dealId, input.operationId)
    if (receipt) {
      if (receipt.phase !== 'cancelled' && receipt.expectedUpdatedAt !== input.expectedUpdatedAt) throw new SfaMutationError(409, '同じAI操作の入力が変わっています。保存結果をご確認ください。')
      return { outcome: await observe(tx, c, key, receipt) }
    }
    const deal = await lockDeal(tx, c, input.dealId, false)
    if (!deal) throw new SfaMutationError(404, '商談が見つかりません。')
    if (typeof deal.name !== 'string' || !deal.name.trim() || deal.name.length > 10000) throw new SfaMutationError(409, '商談名を確認できません。商談名を修正してから実行してください。')
    if (deal.updatedAt.toISOString() !== input.expectedUpdatedAt) throw new SfaMutationError(409, '商談が変更されています。一覧を更新してから実行してください。')
    const [account, stage, activities] = await Promise.all([
      deal.accountId ? tx.sfaAccount.findFirst({ where: { id: deal.accountId, organizationId: c.organizationId, isActive: true }, select: { name: true } }) : null,
      deal.stageId ? tx.sfaStage.findFirst({ where: { id: deal.stageId, pipeline: { organizationId: c.organizationId } }, select: { name: true } }) : null,
      tx.sfaActivity.findMany({ where: { organizationId: c.organizationId, dealId: deal.id }, orderBy: [{ occurredAt: 'desc' }, { id: 'asc' }], take: 8, select: { type: true, subject: true, body: true } }),
    ])
    const quota = await reserveSfaAiUsageInTransaction(tx, c.organizationId, c.userId, 'next-action')
    if ('limit' in quota) return { quota }
    const startedAt = new Date().toISOString()
    await save(tx, key, { version: 1, phase: 'pending', ...input, startedAt, reservationId: quota.id, expiresAt: new Date(Date.now() + LEASE_MS).toISOString() }, false)
    const providerInput: NextActionInput = { dealName: deal.name, accountName: account?.name || null, stageName: stage?.name || null, amount: Number(deal.amount), probability: deal.probability,
      daysSinceLastActivity: deal.lastActivityAt ? Math.floor((new Date(startedAt).getTime() - deal.lastActivityAt.getTime()) / 86400000) : null,
      recentActivities: activities.map(a => `${ACTIVITY_TYPE_LABEL[a.type as ActivityType] || a.type}: ${a.subject || a.body || ''}`.trim()) }
    return { claimed: { providerInput, reservationId: quota.id, startedAt } }
  })
}
export async function recoverNextAction(c: SfaContext, deal: string, operation: string, cancel = false) {
  const operationId = sfaOperationId(operation)
  if (!id(deal) || !operationId) throw new SfaMutationError(400, '商談と操作情報を指定してください。')
  return transaction(c, async tx => {
    await lockSfaMutationActor(tx, c)
    const key = keyFor(c, deal, operationId), receipt = await locked(tx, key, deal, operationId)
    if (!receipt && cancel) { await save(tx, key, { version: 1, phase: 'cancelled', dealId: deal, operationId }, false); return { state: 'cancelled' as const, suggestion: null } }
    return observe(tx, c, key, receipt)
  })
}
export async function settleNextAction(c: SfaContext, input: ReturnType<typeof nextActionOperationInput>, reservationId: string, value: unknown): Promise<SavedNextAction> {
  return transaction(c, async tx => {
    await lockSfaMutationActor(tx, c)
    const key = keyFor(c, input.dealId, input.operationId), r = await locked(tx, key, input.dealId, input.operationId)
    if (!r || r.phase !== 'pending' || r.reservationId !== reservationId || r.expectedUpdatedAt !== input.expectedUpdatedAt || new Date(r.expiresAt!).getTime() <= Date.now()) throw new SfaMutationError(409, 'このAI操作は完了できません。保存結果をご確認ください。')
    const deal = await lockDeal(tx, c, input.dealId, false)
    if (!deal || deal.updatedAt.toISOString() !== input.expectedUpdatedAt) throw new SfaMutationError(409, '商談が変更されています。一覧をご確認ください。')
    const result = parseNextActionResult(value, day(r.startedAt!))
    const saved = { ...result, id: input.operationId, dealId: input.dealId, dealName: deal.name, sourceUpdatedAt: input.expectedUpdatedAt, startedAt: r.startedAt! }
    await completeSfaAiUsage(reservationId, tx)
    await save(tx, key, { ...r, phase: 'complete', result: saved }, true)
    return saved
  })
}
/** Internal cleanup can refund only this pending claim after actor revocation. */
export async function failNextAction(c: SfaContext, input: ReturnType<typeof nextActionOperationInput>, reservationId: string) {
  return transaction(c, async tx => {
    const key = keyFor(c, input.dealId, input.operationId), r = await locked(tx, key, input.dealId, input.operationId)
    if (!r || r.phase !== 'pending' || r.reservationId !== reservationId) return
    await releaseSfaAiUsage(reservationId, tx); await save(tx, key, { ...r, phase: 'failed' }, true)
  })
}
