import { createHash } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { reserveArticleBudgetInTransaction, refundArticleBudgetInTransaction, type ArticleBudgetIdentity, type ArticleClaim } from './article-budget'

type Identity = Pick<ArticleBudgetIdentity, 'userId' | 'guestId' | 'projectId'> & { operationId: string }
type Input = Identity & { plan: ArticleBudgetIdentity['plan']; recipeId: string; displayFormat: string; customInstructions?: string }
export type ArticleOperationResult = { draftId: string; wordCount: number; version: number }
type Code = 'ARTICLE_LIMIT' | 'GENERATION_FAILED' | 'OPERATION_EXPIRED' | null
type Receipt = Identity & {
  version: 1; inputHash: string | null; phase: 'pending' | 'cancelling' | 'completed' | 'failed' | 'cancelled'
  startedAt: string; claim: ArticleClaim | null; refunded: boolean; limit: number | null
  result: ArticleOperationResult | null; code: Code
}
export type ArticleOperation = {
  operationId: string; state: Receipt['phase'] | 'started' | 'missing' | 'busy'
  result: ArticleOperationResult | null; code: Code; limit: number | null
}
type Db = Pick<typeof prisma, '$transaction' | 'interviewProject'>
const options = { isolationLevel: 'ReadCommitted' as const, maxWait: 10_000, timeout: 30_000 }
export const ARTICLE_OPERATION_LEASE_MS = 10 * 60 * 1000
const validId = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(v)
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex')
const subject = (i: Identity) => i.userId ? `user:${i.userId}` : `guest:${i.guestId}`
const budgetKey = (i: Identity) => 'interview-article:v1:' + createHash('sha256').update(subject(i)).digest('hex')
const receiptKey = (i: Identity) => 'interview-article-operation:v1:' + hash([subject(i), i.projectId, i.operationId])
const activeKey = (i: Identity) => 'interview-article-active:v1:' + hash(i.projectId)

export class ArticleOperationError extends Error {
  constructor(readonly code: string, readonly status = 409) {
    super('記事の処理状況を確認できません。再生成せず、保存済みの記事を確認してください。')
  }
}
function identity(input: Identity): Identity {
  if (!input || !validId(input.projectId) || typeof input.operationId !== 'string' || !uuid.test(input.operationId)
    || (input.userId !== null && !validId(input.userId)) || (input.guestId !== null && !validId(input.guestId))
    || (!input.userId && !input.guestId)) throw new ArticleOperationError('INVALID_OPERATION', 400)
  return { userId: input.userId, guestId: input.userId ? null : input.guestId, projectId: input.projectId, operationId: input.operationId.toLowerCase() }
}
function inputHash(input: Input) {
  if (!validId(input.recipeId) || !['MONOLOGUE', 'QA'].includes(input.displayFormat)
    || (input.customInstructions !== undefined && (typeof input.customInstructions !== 'string' || input.customInstructions.length > 20_000))
    || !['GUEST', 'FREE', 'LIGHT', 'PRO', 'ENTERPRISE'].includes(input.plan)) throw new ArticleOperationError('INVALID_OPERATION', 400)
  return hash([input.recipeId, input.displayFormat, input.customInstructions || ''])
}
function validResult(value: unknown): value is ArticleOperationResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const r = value as ArticleOperationResult
  return validId(r.draftId) && Number.isSafeInteger(r.wordCount) && r.wordCount >= 0 && r.wordCount <= 512 * 1024
    && Number.isSafeInteger(r.version) && r.version >= 1 && Object.keys(r).every(k => ['draftId', 'wordCount', 'version'].includes(k))
}
function parse(raw: string, key: string, expected?: Identity): Receipt {
  try {
    if (Buffer.byteLength(raw) > 8192) throw new Error()
    const r: Receipt = JSON.parse(raw), i = identity(r)
    if (r.version !== 1 || receiptKey(i) !== key || r.operationId !== i.operationId || r.guestId !== i.guestId
      || (expected && receiptKey(expected) !== key) || !['pending', 'cancelling', 'completed', 'failed', 'cancelled'].includes(r.phase)
      || typeof r.startedAt !== 'string' || !Number.isFinite(Date.parse(r.startedAt)) || typeof r.refunded !== 'boolean'
      || ![null, 'ARTICLE_LIMIT', 'GENERATION_FAILED', 'OPERATION_EXPIRED'].includes(r.code)) throw new Error()
    if (r.inputHash === null ? r.phase !== 'cancelled' || r.claim !== null || r.limit !== null : !/^[a-f0-9]{64}$/.test(r.inputHash)) throw new Error()
    if (r.claim !== null && (!r.claim || typeof r.claim !== 'object' || r.claim.key !== budgetKey(i)
      || r.claim.guestId !== i.guestId || !/^\d{4}-\d{2}-\d{2}$/.test(r.claim.day))) throw new Error()
    if (r.limit !== null && ![2, 5, 10, 30, 100].includes(r.limit)) throw new Error()
    if ((r.phase === 'pending' || r.phase === 'cancelling') && (!r.claim || r.refunded || r.code !== null || r.limit === null)) throw new Error()
    if (r.phase === 'completed' ? !r.claim || r.refunded || r.code !== null || r.limit === null || !validResult(r.result) : r.result !== null) throw new Error()
    if (r.phase === 'failed' && (r.code === null || (r.code === 'ARTICLE_LIMIT' ? r.claim !== null || r.refunded || r.limit === null : !r.claim || !r.refunded || r.limit === null))) throw new Error()
    if (r.phase === 'cancelled' && (r.code !== null || (r.claim !== null) !== r.refunded)) throw new Error()
    return r
  } catch { throw new ArticleOperationError('INVALID_RECEIPT') }
}
async function read(tx: Prisma.TransactionClient, i: Identity) {
  const row = await tx.systemSetting.findUnique({ where: { key: receiptKey(i) }, select: { value: true } })
  return row ? parse(row.value, receiptKey(i), i) : null
}
async function write(tx: Prisma.TransactionClient, receipt: Receipt) {
  const key = receiptKey(receipt), value = JSON.stringify(receipt)
  parse(value, key, receipt)
  await tx.systemSetting.upsert({ where: { key }, create: { key, value }, update: { value } })
}
const dto = (i: Identity, r: Receipt | null, state?: ArticleOperation['state']): ArticleOperation => ({
  operationId: i.operationId, state: state || r?.phase || 'missing', result: r?.result || null, code: r?.code || null, limit: r?.limit || null,
})
async function release(tx: Prisma.TransactionClient, i: Identity) {
  await tx.systemSetting.deleteMany({ where: { key: activeKey(i), value: receiptKey(i) } })
}
async function verifyActive(tx: Prisma.TransactionClient, r: Receipt) {
  if (r.phase !== 'pending' && r.phase !== 'cancelling') return
  const active = await tx.systemSetting.findUnique({ where: { key: activeKey(r) }, select: { value: true } })
  if (active?.value !== receiptKey(r)) throw new ArticleOperationError('INVALID_RECEIPT')
}
async function fail(tx: Prisma.TransactionClient, r: Receipt, phase: 'failed' | 'cancelled', code: Code): Promise<Receipt> {
  await verifyActive(tx, r)
  if (r.phase !== 'pending' && r.phase !== 'cancelling') return r
  if (r.phase === 'cancelling') { phase = 'cancelled'; code = null }
  // Terminal state and refund are one commit. Replays cannot refund another attempt.
  if (r.claim) await refundArticleBudgetInTransaction(r.claim, tx)
  const next = { ...r, phase, code, refunded: !!r.claim, result: null }
  await write(tx, next); await release(tx, r)
  return next
}
async function expire(tx: Prisma.TransactionClient, r: Receipt, now: Date) {
  await verifyActive(tx, r)
  return (r.phase === 'pending' || r.phase === 'cancelling') && now.getTime() - Date.parse(r.startedAt) >= ARTICLE_OPERATION_LEASE_MS
    ? fail(tx, r, 'failed', 'OPERATION_EXPIRED') : r
}

/** Global lock order matches guest transfer: guest identity, project lifecycle, receipt. */
async function transaction<T>(i: Identity, db: Db, owned: boolean, work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  const seed = await db.interviewProject.findUnique({ where: { id: i.projectId }, select: { guestId: true } })
  const guestLock = i.guestId || seed?.guestId || null
  return db.$transaction(async tx => {
    if (guestLock) await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('interview-guest-project'), hashtext(${guestLock}))`
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('interview-project-lifecycle'), hashtext(${i.projectId}))`
    const project = await tx.interviewProject.findUnique({ where: { id: i.projectId }, select: { userId: true, guestId: true } })
    if (project && project.guestId !== (seed?.guestId || null)) throw new ArticleOperationError('OWNER_CHANGED')
    if (owned && (!project || (i.userId ? project.userId !== i.userId : !!project.userId || project.guestId !== i.guestId))) throw new ArticleOperationError('OWNER_CHANGED', 404)
    return work(tx)
  }, options)
}
function validTime(now: Date) { if (!Number.isFinite(now.getTime())) throw new ArticleOperationError('INVALID_OPERATION', 400) }

/** Same ID replays receipt; changed input conflicts. At most one active article per project. */
export async function beginArticleOperation(input: Input, db: Db = prisma, now = new Date()): Promise<ArticleOperation> {
  const i = identity(input), fingerprint = inputHash(input); validTime(now)
  return transaction(i, db, true, async tx => {
    const previous = await read(tx, i)
    if (previous) {
      if (previous.inputHash !== null && previous.inputHash !== fingerprint) throw new ArticleOperationError('INPUT_CHANGED')
      return dto(i, await expire(tx, previous, now))
    }
    const active = await tx.systemSetting.findUnique({ where: { key: activeKey(i) }, select: { value: true } })
    if (active) {
      if (!/^interview-article-operation:v1:[a-f0-9]{64}$/.test(active.value)) throw new ArticleOperationError('INVALID_RECEIPT')
      const row = await tx.systemSetting.findUnique({ where: { key: active.value }, select: { value: true } })
      if (!row) throw new ArticleOperationError('INVALID_RECEIPT')
      const other = parse(row.value, active.value)
      if (other.projectId !== i.projectId || (other.guestId && other.guestId !== i.guestId && other.guestId !== (await tx.interviewProject.findUnique({ where: { id: i.projectId }, select: { guestId: true } }))?.guestId)) throw new ArticleOperationError('INVALID_RECEIPT')
      const current = await expire(tx, other, now)
      if (current.phase === 'pending' || current.phase === 'cancelling') return dto(i, null, 'busy')
      await release(tx, other)
    }
    const admission = await reserveArticleBudgetInTransaction({ ...i, plan: input.plan }, tx)
    if (admission.state !== 'allowed' && admission.state !== 'limit') throw new ArticleOperationError('BUDGET_UNAVAILABLE', 503)
    const r: Receipt = { ...i, version: 1, inputHash: fingerprint, phase: admission.state === 'allowed' ? 'pending' : 'failed',
      startedAt: now.toISOString(), claim: admission.state === 'allowed' ? admission.claim : null, refunded: false,
      limit: admission.limit, result: null, code: admission.state === 'limit' ? 'ARTICLE_LIMIT' : null }
    await write(tx, r)
    if (r.phase === 'pending') await tx.systemSetting.upsert({ where: { key: activeKey(i) }, create: { key: activeKey(i), value: receiptKey(i) }, update: { value: receiptKey(i) } })
    return dto(i, r, r.phase === 'pending' ? 'started' : undefined)
  })
}

/** Public route must authenticate the identity. Recovery never invokes provider or reserves usage. */
export async function recoverArticleOperation(input: Identity, cancel = false, db: Db = prisma, now = new Date()): Promise<ArticleOperation> {
  const i = identity(input); validTime(now)
  return transaction(i, db, true, async tx => {
    let r = await read(tx, i)
    if (r) r = await expire(tx, r, now)
    if (cancel && !r) {
      r = { ...i, version: 1, inputHash: null, phase: 'cancelled', startedAt: now.toISOString(), claim: null, refunded: false, limit: null, result: null, code: null }
      await write(tx, r)
    } else if (cancel && r?.phase === 'pending') {
      // Hold the active pointer and reservation until the original worker has
      // stopped. A second tab cannot overlap another provider with a refund.
      r = { ...r, phase: 'cancelling' }
      await write(tx, r)
    }
    return dto(i, r)
  })
}

/** Call only after the admitted worker stops (or fails before provider). Finalizes cancellation too. */
export async function failArticleOperation(input: Identity, db: Db = prisma, now = new Date()): Promise<ArticleOperation> {
  const i = identity(input); validTime(now)
  return transaction(i, db, false, async tx => {
    const r = await read(tx, i)
    if (!r) throw new ArticleOperationError('OPERATION_MISSING')
    return dto(i, await fail(tx, r, 'failed', 'GENERATION_FAILED'))
  })
}

/** Article write callback and completion receipt commit atomically; fenced work never writes. */
export async function completeArticleOperation(
  input: Identity, save: (tx: Prisma.TransactionClient) => Promise<ArticleOperationResult>, db: Db = prisma, now = new Date(),
): Promise<ArticleOperation> {
  const i = identity(input); validTime(now)
  return transaction(i, db, true, async tx => {
    let r = await read(tx, i)
    if (!r) throw new ArticleOperationError('OPERATION_MISSING')
    r = await expire(tx, r, now)
    if (r.phase !== 'pending') return dto(i, r)
    const result = await save(tx)
    if (!validResult(result)) throw new ArticleOperationError('INVALID_RESULT')
    const draft = await tx.interviewDraft.findUnique({ where: { id: result.draftId }, select: { projectId: true, wordCount: true, version: true } })
    if (!draft || draft.projectId !== i.projectId || draft.wordCount !== result.wordCount || draft.version !== result.version) throw new ArticleOperationError('INVALID_RESULT')
    r = { ...r, phase: 'completed', result, code: null }
    await write(tx, r); await release(tx, r)
    return dto(i, r)
  })
}
