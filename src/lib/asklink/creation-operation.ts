import { createHash, randomUUID } from 'node:crypto'
import { ASKLINK_CREATION_PREFIX, askLinkCreationReceiptPrefix } from './creation-receipts'
export { ASKLINK_CREATION_PREFIX, askLinkCreationReceiptPrefix } from './creation-receipts'
import { Prisma, type AskLinkRun } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { assertLimitForTier, type QuotaResult } from '@/lib/plan-limit'
import { isPaidPlan } from '@/lib/unified-plan'
import type { AskLink, Audience, BannerCopy, SiteProfile } from './types'

export const ASKLINK_CREATION_ADMISSION_MS = 24 * 60 * 60 * 1000
export const ASKLINK_CREATION_RETENTION_MS = 30 * 24 * 60 * 60 * 1000
export const ASKLINK_CREATION_MAX_RECEIPTS = 512
export const ASKLINK_CREATION_LEASE_MS = 360_000 // API maxDuration=300秒。期限だけで再生成・返金しない。
export type AskLinkCreationInput = { sourceUrl: string; manualText: string }
type Identity = { actor: string; operationId: string }
type Failure = 'QUOTA_REACHED' | 'WEBSITE_UNREADABLE' | 'GENERATION_FAILED' | 'OPERATION_EXPIRED'
type Phase = 'pending' | 'completed' | 'failed' | 'canceled' | 'superseded'
type Receipt = { version: 2; actorId: string; firstAcceptedAt: string; owner: string; operationId: string; fingerprint: string | null; phase: Phase; runId: string | null; runVersion: string | null; reservationHash?: string; claim: string | null; startedAt: string | null; failure: Failure | null; quota: QuotaResult | null }
export type AskLinkCreationState = { operationId: string; fingerprint: string | null; state: Phase | 'missing' | 'unknown' | 'deleted' | 'expired'; runId: string | null; reserved: boolean; canFinalize: boolean; failure: Failure | null; quota: QuotaResult | null }
export type AskLinkCreationClaim = Identity & { token: string; runId: string }
export type AskLinkCreationOutput = { site: SiteProfile; allowedUrls: string[]; audience: Audience; links: AskLink[]; bannerCopy: BannerCopy }
type Db = Pick<typeof prisma, '$transaction'>
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const iso = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value
const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const options = { isolationLevel: 'Serializable' as const, maxWait: 10000, timeout: 20000 }
export class AskLinkCreationError extends Error {
  constructor(readonly status: number, readonly code: string) { super('質問リンクの作成状態を確認できません。保存結果を確認してから続けてください。') }
}
export function validAskLinkCreationId(value: unknown): value is string {
  return typeof value === 'string' && /^\d{13}\.[a-f0-9-]{36}$/i.test(value) && uuid.test(value.slice(14))
}
function operationTime(operationId: string) { return Number(operationId.slice(0, 13)) }
function validateOperationTime(i: Identity, now: Date) {
  if (operationTime(i.operationId) > now.getTime() + 300_000) throw new AskLinkCreationError(400, 'INVALID_OPERATION')
}
function admissionExpired(i: Identity, now: Date) { return now.getTime() - operationTime(i.operationId) >= ASKLINK_CREATION_ADMISSION_MS }
function retentionExpired(r: Receipt, now: Date) { return now.getTime() - Date.parse(r.firstAcceptedAt) >= ASKLINK_CREATION_RETENTION_MS }
function expired(i: Identity): AskLinkCreationState {
  return { operationId: i.operationId, fingerprint: null, state: 'expired', runId: null, reserved: false, canFinalize: false, failure: null, quota: null }
}
function identity(value: Identity): Identity {
  if (!value || typeof value.actor !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(value.actor) || !validAskLinkCreationId(value.operationId)) throw new AskLinkCreationError(400, 'INVALID_OPERATION')
  return { actor: value.actor, operationId: value.operationId.toLowerCase() }
}
export function normalizeAskLinkCreationInput(value: AskLinkCreationInput): AskLinkCreationInput {
  if (!object(value) || Object.keys(value).some(k => !['sourceUrl', 'manualText'].includes(k)) || typeof value.sourceUrl !== 'string' || value.sourceUrl.length > 8192 || typeof value.manualText !== 'string') throw new AskLinkCreationError(400, 'INVALID_INPUT')
  let url: URL
  try { url = new URL(value.sourceUrl) } catch { throw new AskLinkCreationError(400, 'INVALID_INPUT') }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash || url.toString() !== value.sourceUrl) throw new AskLinkCreationError(400, 'INVALID_INPUT')
  const manualText = value.manualText.trim()
  if (manualText && (manualText.length < 20 || manualText.length > 3000)) throw new AskLinkCreationError(400, 'INVALID_INPUT')
  return { sourceUrl: value.sourceUrl, manualText }
}
export function askLinkCreationFingerprint(input: AskLinkCreationInput) { const v = normalizeAskLinkCreationInput(input); return hash([v.sourceUrl, v.manualText]) }
function key(i: Identity) { return askLinkCreationReceiptPrefix(i.actor) + i.operationId }
function validateTime(now: Date) { if (!Number.isFinite(now.getTime())) throw new AskLinkCreationError(400, 'INVALID_TIME') }
function readReceipt(raw: string, i: Identity): Receipt {
  try {
    if (Buffer.byteLength(raw) > 8192) throw Error()
    const r = JSON.parse(raw) as Receipt
    if (!object(r) || r.version !== 2 || r.actorId !== i.actor || !iso(r.firstAcceptedAt) || r.owner !== hash(i.actor) || r.operationId !== i.operationId || !['pending', 'completed', 'failed', 'canceled', 'superseded'].includes(r.phase) ||
      !(r.fingerprint === null || typeof r.fingerprint === 'string' && /^[a-f0-9]{64}$/.test(r.fingerprint)) || !(r.runId === null || typeof r.runId === 'string' && /^[a-z0-9]{20,40}$/i.test(r.runId)) ||
      !(r.runVersion === null || iso(r.runVersion)) || !(r.reservationHash === undefined || typeof r.reservationHash === 'string' && /^[a-f0-9]{64}$/.test(r.reservationHash)) || !(r.claim === null || uuid.test(r.claim)) || !(r.startedAt === null || iso(r.startedAt)) ||
      ![null, 'QUOTA_REACHED', 'WEBSITE_UNREADABLE', 'GENERATION_FAILED', 'OPERATION_EXPIRED'].includes(r.failure)) throw Error()
    if (['pending', 'completed', 'superseded'].includes(r.phase) && (!r.fingerprint || !r.runId || !r.runVersion || !r.claim || !r.startedAt || r.failure !== null || r.quota !== null)) throw Error()
    if (r.phase === 'canceled' && (r.fingerprint !== null || r.runId !== null || r.runVersion !== null || r.claim !== null || r.startedAt !== null || r.failure !== null || r.quota !== null)) throw Error()
    if (r.phase === 'failed' && (!r.fingerprint || r.runId !== null || r.runVersion !== null || !r.failure)) throw Error()
    if (r.failure === 'QUOTA_REACHED') {
      if (!object(r.quota) || r.quota.ok !== false || typeof r.quota.reason !== 'string' || r.quota.reason.length > 1024 || !Number.isSafeInteger(r.quota.used) || Number(r.quota.used) < 0 || !Number.isSafeInteger(r.quota.limit) || Number(r.quota.limit) < 1 || r.claim !== null || r.startedAt !== null) throw Error()
    } else if (r.quota !== null) throw Error()
    if (r.phase === 'failed' && r.failure !== 'QUOTA_REACHED' && (!r.claim || !r.startedAt)) throw Error()
    return r
  } catch { throw new AskLinkCreationError(409, 'INVALID_RECEIPT') }
}
async function lockUser(tx: Prisma.TransactionClient, actor: string) {
  // 同じ接続で現在のUser/planを読む。別のprisma呼出しをTx内で待たせない。
  const users = await tx.$queryRaw<Array<{ id: string; plan: string }>>`SELECT "id", "plan" FROM "User" WHERE "id" = ${actor} FOR UPDATE`
  const user = users.find(u => u.id === actor)
  if (!user) throw new AskLinkCreationError(401, 'ACTOR_UNAVAILABLE')
  return user.plan.trim().toUpperCase() === 'ENTERPRISE' ? 'ENTERPRISE' as const : isPaidPlan(user.plan) ? 'PRO' as const : 'FREE' as const
}
async function transaction<T>(i: Identity, db: Db, work: (tx: Prisma.TransactionClient, tier: 'FREE' | 'PRO' | 'ENTERPRISE') => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 8; attempt++) {
    try { return await db.$transaction(async tx => work(tx, await lockUser(tx, i.actor)), options) }
    catch (error) {
      const e = error as { code?: string; meta?: { code?: string } }
      // Raw SELECT ... FOR UPDATE reports PostgreSQL serialization/deadlock as P2010.
      const conflict = e.code === 'P2034' || e.code === 'P2010' && ['40001', '40P01'].includes(e.meta?.code || '')
      if (!conflict || attempt === 7) throw error
    }
  }
  throw new AskLinkCreationError(503, 'ADMISSION_UNAVAILABLE')
}
async function read(tx: Prisma.TransactionClient, i: Identity) {
  const row = await tx.systemSetting.findUnique({ where: { key: key(i) }, select: { value: true } })
  return row ? readReceipt(row.value, i) : null
}
async function write(tx: Prisma.TransactionClient, i: Identity, r: Receipt) {
  const value = JSON.stringify(r); readReceipt(value, i)
  await tx.systemSetting.upsert({ where: { key: key(i) }, create: { key: key(i), value }, update: { value } })
}
async function view(tx: Prisma.TransactionClient, i: Identity, r: Receipt | null, now: Date): Promise<AskLinkCreationState> {
  const state: AskLinkCreationState = { operationId: i.operationId, fingerprint: r?.fingerprint || null, state: r?.phase || 'missing', runId: r?.runId || null, reserved: false, canFinalize: false, failure: r?.failure || null, quota: r?.quota || null }
  if (r?.runId) {
    const run = await tx.askLinkRun.findFirst({ where: { id: r.runId, userId: i.actor }, select: { id: true } })
    state.reserved = Boolean(run)
    if (!run && (r.phase === 'completed' || r.phase === 'superseded')) state.state = 'deleted'
  }
  if (r?.phase === 'pending' && now.getTime() - Date.parse(r.startedAt!) >= ASKLINK_CREATION_LEASE_MS) { state.state = 'unknown'; state.canFinalize = true }
  return state
}
function empty(i: Identity, now: Date): Receipt { return { version: 2, actorId: i.actor, firstAcceptedAt: now.toISOString(), owner: hash(i.actor), operationId: i.operationId, fingerprint: null, phase: 'canceled', runId: null, runVersion: null, claim: null, startedAt: null, failure: null, quota: null } }
// Prisma's millisecond @updatedAt is not by itself an exclusive row revision.
// Compare every initialized output field and bind the reservation's source metadata.
function unchanged(i: Identity, r: Receipt) {
  return { id: r.runId!, userId: i.actor, updatedAt: new Date(r.runVersion!), linkGenerations: 0,
    audience: 'b2b', detectedAudience: 'b2b', site: { equals: {} }, allowedUrls: { equals: [] },
    links: { equals: Prisma.DbNull }, bannerCopy: { equals: Prisma.DbNull }, banners: { none: {} } }
}
type ReservationMetadata = Pick<AskLinkRun, 'id' | 'userId' | 'sourceUrl' | 'source' | 'audience' | 'detectedAudience' | 'createdAt'>
function reservationHash(run: ReservationMetadata) {
  return hash([run.id, run.userId, run.sourceUrl, run.source, run.audience, run.detectedAudience, run.createdAt.toISOString()])
}
async function currentReservation(tx: Prisma.TransactionClient, i: Identity, r: Receipt) {
  // An older receipt cannot prove the original metadata. Retain its row and quota;
  // never infer that it is safe to overwrite/delete or automatically regenerate it.
  if (!r.reservationHash) return null
  const run = await tx.askLinkRun.findFirst({ where: unchanged(i, r) })
  return run && reservationHash(run) === r.reservationHash ? run : null
}
function reservationWhere(i: Identity, r: Receipt, run: ReservationMetadata) {
  return { ...unchanged(i, r), sourceUrl: run.sourceUrl, source: run.source, createdAt: run.createdAt }
}

/** One UUID admits one run/provider claim. A different UUID remains a deliberate new creation. */
export async function beginAskLinkCreation(input: Identity & AskLinkCreationInput, db: Db = prisma, now = new Date()): Promise<{ operation: AskLinkCreationState; claim: AskLinkCreationClaim | null }> {
  const i = identity(input); validateTime(now); validateOperationTime(i, now)
  const normalized = normalizeAskLinkCreationInput({ sourceUrl: input.sourceUrl, manualText: input.manualText }), fingerprint = askLinkCreationFingerprint(normalized)
  return transaction(i, db, async (tx, tier) => {
    const previous = await read(tx, i)
    if (previous) {
      if (retentionExpired(previous, now)) return { operation: expired(i), claim: null }
      if (previous.fingerprint !== null && previous.fingerprint !== fingerprint) throw new AskLinkCreationError(409, 'INPUT_CHANGED')
      return { operation: await view(tx, i, previous, now), claim: null }
    }
    if (admissionExpired(i, now)) return { operation: expired(i), claim: null }
    await assertReceiptCapacity(tx, i)
    const quota = await assertLimitForTier('asklinkRuns', tier, () => tx.askLinkRun.count({ where: { userId: i.actor } }), since => tx.askLinkRun.count({ where: { userId: i.actor, createdAt: { gte: since } } }))
    if (!quota.ok) {
      const r: Receipt = { ...empty(i, now), fingerprint, phase: 'failed', failure: 'QUOTA_REACHED', quota: { ok: false, reason: quota.reason || '作成回数の上限に達しました。', used: quota.used ?? 0, limit: quota.limit ?? 1 } }
      await write(tx, i, r); return { operation: await view(tx, i, r, now), claim: null }
    }
    const run = await tx.askLinkRun.create({ data: { userId: i.actor, sourceUrl: normalized.sourceUrl, source: normalized.manualText ? 'manual' : 'site', site: {}, allowedUrls: [] }, select: { id: true, userId: true, sourceUrl: true, source: true, audience: true, detectedAudience: true, createdAt: true, updatedAt: true } })
    const token = randomUUID(), r: Receipt = { ...empty(i, now), fingerprint, phase: 'pending', runId: run.id, runVersion: run.updatedAt.toISOString(), reservationHash: reservationHash(run), claim: token, startedAt: now.toISOString() }
    await write(tx, i, r)
    return { operation: await view(tx, i, r, now), claim: { ...i, token, runId: run.id } }
  })
}

/** GET is observational. Ending a missing request creates a tombstone; a pending request is not canceled early. */
export async function recoverAskLinkCreation(input: Identity, finalize = false, db: Db = prisma, now = new Date()): Promise<AskLinkCreationState> {
  const i = identity(input); validateTime(now); validateOperationTime(i, now)
  return transaction(i, db, async tx => {
    let r = await read(tx, i)
    if (r ? retentionExpired(r, now) : admissionExpired(i, now)) return expired(i)
    if (finalize && !r) await assertReceiptCapacity(tx, i)
    if (finalize && !r) { r = empty(i, now); await write(tx, i, r) }
    else if (finalize && r?.phase === 'pending' && now.getTime() - Date.parse(r.startedAt!) >= ASKLINK_CREATION_LEASE_MS) {
      const existing = await tx.askLinkRun.findFirst({ where: { id: r.runId!, userId: i.actor }, select: { id: true } })
      const current = await currentReservation(tx, i, r)
      if (existing && !current) r = { ...r, phase: 'superseded' }
      else {
        const removed = await tx.askLinkRun.deleteMany({ where: current ? reservationWhere(i, r, current) : unchanged(i, r) })
        if (current && removed.count !== 1) throw new AskLinkCreationError(409, 'RESULT_CHANGED')
        r = { ...r, phase: 'failed', failure: 'OPERATION_EXPIRED', runId: null, runVersion: null }
      }
      await write(tx, i, r) // 同じTxで古い書込を確実に拒否してから、未保存の予約枠を戻す。
    }
    return view(tx, i, r, now)
  })
}

/** Commit output and receipt atomically; stale success/failure never overwrites or deletes another result. */
export async function settleAskLinkCreation(claim: AskLinkCreationClaim, output: AskLinkCreationOutput | null, failure: 'WEBSITE_UNREADABLE' | 'GENERATION_FAILED' = 'GENERATION_FAILED', db: Db = prisma, now = new Date()): Promise<{ operation: AskLinkCreationState; committed: boolean }> {
  const i = identity(claim); validateTime(now); validateOperationTime(i, now)
  if (!uuid.test(claim.token) || typeof claim.runId !== 'string' || !/^[a-z0-9]{20,40}$/i.test(claim.runId) || !['WEBSITE_UNREADABLE', 'GENERATION_FAILED'].includes(failure)) throw new AskLinkCreationError(400, 'INVALID_CLAIM')
  if (output && (!object(output.site) || !Array.isArray(output.allowedUrls) || !['b2b', 'b2c'].includes(output.audience) || !Array.isArray(output.links) || output.links.length !== 2 || !object(output.bannerCopy))) throw new AskLinkCreationError(400, 'INVALID_RESULT')
  return transaction(i, db, async tx => {
    const r = await read(tx, i)
    if (!r) throw new AskLinkCreationError(409, 'OPERATION_MISSING')
    if (retentionExpired(r, now)) return { operation: expired(i), committed: false }
    if (r.phase === 'pending' && now.getTime() - Date.parse(r.startedAt!) >= ASKLINK_CREATION_LEASE_MS) return { operation: await view(tx, i, r, now), committed: false }
    if (r.phase !== 'pending' || r.claim !== claim.token || r.runId !== claim.runId) return { operation: await view(tx, i, r, now), committed: false }
    const current = await currentReservation(tx, i, r)
    if (!current) {
      const existing = await tx.askLinkRun.findFirst({ where: { id: r.runId!, userId: i.actor }, select: { id: true } })
      const next: Receipt = existing ? { ...r, phase: 'superseded' } : { ...r, phase: 'failed', failure: 'GENERATION_FAILED', runId: null, runVersion: null }
      await write(tx, i, next); return { operation: await view(tx, i, next, now), committed: false }
    }
    if (!output) {
      const removed = await tx.askLinkRun.deleteMany({ where: reservationWhere(i, r, current) })
      if (removed.count !== 1) throw new AskLinkCreationError(409, 'RESULT_CHANGED')
      const next: Receipt = { ...r, phase: 'failed', failure, runId: null, runVersion: null }
      await write(tx, i, next); return { operation: await view(tx, i, next, now), committed: false }
    }
    const changed = await tx.askLinkRun.updateMany({ where: reservationWhere(i, r, current), data: { site: output.site as unknown as Prisma.InputJsonValue, allowedUrls: output.allowedUrls, audience: output.audience, detectedAudience: output.audience, links: output.links as unknown as Prisma.InputJsonValue, bannerCopy: output.bannerCopy as unknown as Prisma.InputJsonValue, linkGenerations: 1 } })
    if (changed.count !== 1) throw new AskLinkCreationError(409, 'RESULT_CHANGED')
    const next: Receipt = { ...r, phase: 'completed' }; await write(tx, i, next)
    return { operation: await view(tx, i, next, now), committed: true }
  })
}

async function assertReceiptCapacity(tx: Prisma.TransactionClient, i: Identity) {
  if (await tx.systemSetting.count({ where: { key: { startsWith: askLinkCreationReceiptPrefix(i.actor) } } }) >= ASKLINK_CREATION_MAX_RECEIPTS) {
    throw new AskLinkCreationError(429, 'RECEIPT_LIMIT')
  }
}

const GC_CURSOR = 'asklink-create-gc-cursor:v2'
/** A rotating bounded sweep. Never deletes completed runs or another service's metadata. */
export async function collectAskLinkCreationReceipts(db = prisma, now = new Date(), batch = 25) {
  validateTime(now)
  if (!Number.isSafeInteger(batch) || batch < 1 || batch > 100) throw new AskLinkCreationError(400, 'INVALID_BATCH')
  const saved = await db.systemSetting.findUnique({ where: { key: GC_CURSOR }, select: { value: true } })
  const cursor = saved?.value.startsWith(ASKLINK_CREATION_PREFIX) ? saved.value : ''
  const rows = await db.systemSetting.findMany({ where: { key: { startsWith: ASKLINK_CREATION_PREFIX, ...(cursor ? { gt: cursor } : {}) } }, orderBy: { key: 'asc' }, take: batch, select: { key: true, value: true } })
  const result = { checked: 0, removed: 0, retained: 0, failed: 0 }
  let last = cursor
  const deadline = Date.now() + 15_000
  for (const row of rows) {
    if (Date.now() >= deadline) break
    last = row.key; result.checked++
    try {
      const raw: unknown = JSON.parse(row.value)
      if (!object(raw) || typeof raw.actorId !== 'string' || typeof raw.operationId !== 'string') throw Error('Invalid receipt')
      const i = identity({ actor: raw.actorId, operationId: raw.operationId })
      if (key(i) !== row.key) throw Error('Receipt identity mismatch')
      const snapshot = readReceipt(row.value, i)
      if (!retentionExpired(snapshot, now)) { result.retained++; continue }
      const removed = await db.$transaction(async tx => {
        // Even a missing run can only be collected while its User lock is held.
        await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${i.actor} FOR UPDATE`
        const latest = await tx.systemSetting.findUnique({ where: { key: row.key }, select: { value: true } })
        if (!latest || latest.value !== row.value) return 0
        const r = readReceipt(latest.value, i)
        if (!retentionExpired(r, now)) return 0
        if (r.phase === 'pending') {
          // Time alone is insufficient: require the original claim and the whole untouched reservation.
          const reservation = await currentReservation(tx, i, r)
          if (reservation) {
            const removedRun = await tx.askLinkRun.deleteMany({ where: reservationWhere(i, r, reservation) })
            if (removedRun.count !== 1) throw new AskLinkCreationError(409, 'RESULT_CHANGED')
          }
        }
        return (await tx.systemSetting.deleteMany({ where: { key: row.key, value: latest.value } })).count
      }, { isolationLevel: 'ReadCommitted', maxWait: 10000, timeout: 20000 })
      if (removed) result.removed++; else result.retained++
    } catch { result.failed++ }
  }
  const next = rows.length === 0 || rows.length < batch && result.checked === rows.length ? '' : last
  await db.systemSetting.upsert({ where: { key: GC_CURSOR }, create: { key: GC_CURSOR, value: next }, update: { value: next } })
  return result
}
