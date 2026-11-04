import { randomUUID } from 'node:crypto'
import type { Prisma, PrismaClient } from '@prisma/client'
import type { SeatReconciliationProof } from './seat-reconciliation-proof'
import type { PendingSeatChange } from './seat-operation-view'
import { prisma } from '@/lib/prisma'
import { isValidOperationKey } from './team'

// All seat/invite/cache writers must adopt the same guard. Network calls never
// run inside the guard's SQL transaction.
const PREFIX = 'team-seat-operation:v1:'
const LEASE_MS = 5 * 60_000
// Stripe v1 can discard an idempotency key after 24h. Stop automatic replay
// earlier; an unresolved older attempt requires explicit reconciliation.
const RETRY_WINDOW_MS = 20 * 60 * 60_000

type Db = Pick<PrismaClient, '$transaction'>
type Tx = Prisma.TransactionClient
export type SeatRequest = {
  subscriptionId: string
  seatItemId: string
  from: number
  to: number
  direction: 'up' | 'down'
  interval: 'month' | 'year'
  used: number
  status: string
  grantPoints: boolean
  pointsAt: number
}
export type SeatOperationResult = {
  seats: number; used: number; monthly: number; points: number; addedPoints: number
}
type Preparing = {
  phase: 'preparing'; operationKey: string; requested: number
  token: string; leaseUntil: number
}
type Updating = Omit<Preparing, 'phase'> & {
  phase: 'stripe'; request: SeatRequest; idempotencyKey: string; firstSentAt: number
  reconciliation?: { eventId: string; invoiceId: string | null; verifiedAt: number }
}
type Active = Preparing | Updating
type State = { revision: number; active: Active | null }
export type SeatOperationClaim = { companyId: string; token: string; active: Active }
export type SeatOperationStart =
  | { kind: 'claimed'; claim: SeatOperationClaim }
  | { kind: 'replay'; result: SeatOperationResult }
  | { kind: 'rejected'; code: 'PAYMENT_FAILED' }
type CompletedSeatOperation = Exclude<SeatOperationStart, { kind: 'claimed' }>

export class SeatOperationError extends Error {
  constructor(public readonly code: 'SEAT_OPERATION_BUSY' | 'SEAT_OPERATION_STALE' | 'SEAT_OPERATION_RECONCILE' | 'SEAT_OPERATION_CONFLICT') {
    super(code)
  }
}

const seatCount = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 49
const timestamp = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0
const opaque = (s: unknown): s is string => typeof s === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(s)
function companyKey(companyId: string) {
  if (!opaque(companyId)) throw new Error('Invalid company identifier')
  return PREFIX + companyId
}
function requestValid(r: unknown): r is SeatRequest {
  if (!r || typeof r !== 'object') return false
  const x = r as Record<string, unknown>
  return opaque(x.subscriptionId) && opaque(x.seatItemId) && seatCount(x.from) && seatCount(x.to) &&
    x.from !== x.to && x.direction === (x.to > x.from ? 'up' : 'down') &&
    (x.interval === 'month' || x.interval === 'year') && timestamp(x.used) && x.used >= 1 && x.used <= x.to &&
    opaque(x.status) && typeof x.grantPoints === 'boolean' && (x.direction === 'up' || !x.grantPoints) && timestamp(x.pointsAt)
}
function resultValid(r: unknown): r is SeatOperationResult {
  if (!r || typeof r !== 'object') return false
  const x = r as Record<string, unknown>
  return seatCount(x.seats) && ['used', 'monthly', 'points', 'addedPoints'].every(k => timestamp(x[k])) &&
    Number(x.used) >= 1 && Number(x.used) <= Number(x.seats)
}
function parseState(value: string): State {
  const x = JSON.parse(value) as State
  if (!x || !timestamp(x.revision)) throw new Error('Invalid seat operation state')
  if (x.active === null) return x
  const a = x.active
  if (!a || !isValidOperationKey(a.operationKey) || !seatCount(a.requested) || !opaque(a.token) || !timestamp(a.leaseUntil)) throw new Error('Invalid seat operation claim')
  if (a.phase === 'preparing') return x
  if (a.phase === 'stripe' && requestValid(a.request) && a.request.to === a.requested &&
    opaque(a.idempotencyKey) && timestamp(a.firstSentAt) && a.request.pointsAt <= a.firstSentAt) {
    const proof = a.reconciliation
    if (proof !== undefined && (!proof || !opaque(proof.eventId) || !proof.eventId.startsWith('evt_') ||
      (proof.invoiceId !== null && (!opaque(proof.invoiceId) || !proof.invoiceId.startsWith('in_'))) ||
      !timestamp(proof.verifiedAt) || proof.verifiedAt < a.firstSentAt)) throw new Error('Invalid seat reconciliation receipt')
    return x
  }
  throw new Error('Invalid seat operation phase')
}
async function read(tx: Tx, key: string): Promise<State> {
  const row = await tx.systemSetting.findUnique({ where: { key }, select: { value: true } })
  return row ? parseState(row.value) : { revision: 0, active: null }
}
async function readCompleted(tx: Tx, key: string, operationKey: string, requested: number): Promise<CompletedSeatOperation | null> {
  const receipt = await tx.systemSetting.findUnique({ where: { key: key + ':result:' + operationKey }, select: { value: true } })
  if (!receipt) return null
  const saved = JSON.parse(receipt.value) as { requested: number; result?: SeatOperationResult; failure?: string }
  if (saved.failure === 'PAYMENT_FAILED' && seatCount(saved.requested) && !saved.result) {
    if (saved.requested !== requested) throw new SeatOperationError('SEAT_OPERATION_CONFLICT')
    return { kind: 'rejected', code: 'PAYMENT_FAILED' }
  }
  if (!resultValid(saved.result) || saved.requested !== saved.result.seats) throw new Error('Invalid seat operation receipt')
  if (saved.requested !== requested) throw new SeatOperationError('SEAT_OPERATION_CONFLICT')
  return { kind: 'replay', result: saved.result }
}
async function write(tx: Tx, key: string, state: State) {
  if (!timestamp(state.revision + 1)) throw new Error('Seat operation revision exhausted')
  const value = JSON.stringify({ ...state, revision: state.revision + 1 })
  await tx.systemSetting.upsert({ where: { key }, create: { key, value }, update: { value } })
}
async function guarded<T>(companyId: string, db: Db, work: (tx: Tx, key: string) => Promise<T>): Promise<T> {
  const key = companyKey(companyId)
  return db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('team-seat-operation:v1'), hashtext(${companyId}))`
    return work(tx, key)
  }, { isolationLevel: 'ReadCommitted', maxWait: 5000, timeout: 10000 })
}
function owned(state: State, claim: SeatOperationClaim): Active {
  const active = state.active
  if (!active || active.token !== claim.token || active.operationKey !== claim.active.operationKey) throw new SeatOperationError('SEAT_OPERATION_STALE')
  return active
}

/** Admission work must re-read purchased seats and members inside this callback.
 * Keep Stripe/network calls outside this short SQL transaction. Never use a
 * previously captured member limit. Pending Stripe work blocks admission even
 * after its lease expires; expiration allows only a controlled same-key retry.
 */
export async function withSeatAdmission<T>(companyId: string, work: (tx: Tx) => Promise<T>, db: Db = prisma): Promise<T> {
  return guarded(companyId, db, async (tx, key) => {
    const state = await read(tx, key)
    if (state.active) throw new SeatOperationError('SEAT_OPERATION_BUSY')
    const result = await work(tx)
    await write(tx, key, state)
    return result
  })
}

export async function beginSeatOperation(companyId: string, operationKey: string, requested: number, db: Db = prisma, now = Date.now(), options: { existingOnly?: boolean } = {}): Promise<SeatOperationStart> {
  if (!isValidOperationKey(operationKey) || !seatCount(requested) || !timestamp(now) || !timestamp(now + LEASE_MS)) throw new Error('Invalid seat operation input')
  return guarded(companyId, db, async (tx, key) => {
    const completed = await readCompleted(tx, key, operationKey, requested)
    if (completed) return completed
    const state = await read(tx, key)
    const previous = state.active
    if (options.existingOnly && (!previous || previous.operationKey !== operationKey || previous.requested !== requested)) throw new SeatOperationError('SEAT_OPERATION_CONFLICT')
    let active: Active
    if (previous?.phase === 'stripe') {
      if (previous.operationKey !== operationKey || previous.requested !== requested) throw new SeatOperationError('SEAT_OPERATION_BUSY')
      if (now < previous.firstSentAt || now - previous.firstSentAt >= RETRY_WINDOW_MS) throw new SeatOperationError('SEAT_OPERATION_RECONCILE')
      if (now < previous.leaseUntil) throw new SeatOperationError('SEAT_OPERATION_BUSY')
      active = { ...previous, token: randomUUID(), leaseUntil: now + LEASE_MS }
    } else {
      // A timed-out preparation never had permission to call Stripe. Replacing
      // its token prevents the old worker from later recording a Stripe attempt.
      if (previous && now < previous.leaseUntil) throw new SeatOperationError('SEAT_OPERATION_BUSY')
      active = { phase: 'preparing', operationKey, requested, token: randomUUID(), leaseUntil: now + LEASE_MS }
    }
    await write(tx, key, { ...state, active })
    return { kind: 'claimed', claim: { companyId, token: active.token, active } }
  })
}

/** Only expose after the route has confirmed the current company owner. This
 * snapshot is status only: no cache write, Stripe request, or lease renewal.
 */
export async function pendingSeatChangeForOwner(companyId: string, db: Db = prisma, now = Date.now()): Promise<PendingSeatChange | null> {
  if (!timestamp(now)) throw new Error('Invalid status time')
  return guarded(companyId, db, async (tx, key) => {
    const active = (await read(tx, key)).active
    if (!active) return null
    const action = now < active.leaseUntil ? 'wait' : active.phase === 'stripe' && now - active.firstSentAt >= RETRY_WINDOW_MS ? 'check' : 'resume'
    return { operationKey: active.operationKey, requested: active.requested,
      previousSeats: active.phase === 'stripe' ? active.request.from : null, action }
  })
}
export async function readCompletedSeatOperation(companyId: string, operationKey: string, requested: number, db: Db = prisma): Promise<CompletedSeatOperation | null> {
  if (!isValidOperationKey(operationKey) || !seatCount(requested)) throw new Error('Invalid result input')
  return guarded(companyId, db, (tx, key) => readCompleted(tx, key, operationKey, requested))
}

/** Commit the immutable request and Stripe key BEFORE making the network call.
 * A resumed stripe claim already contains this request and must reuse it exactly.
 */
export async function recordSeatStripeAttempt(claim: SeatOperationClaim, request: SeatRequest, db: Db = prisma, now = Date.now()): Promise<SeatOperationClaim> {
  if (!requestValid(request) || !timestamp(now) || !timestamp(now + LEASE_MS)) throw new Error('Invalid Stripe seat request')
  return guarded(claim.companyId, db, async (tx, key) => {
    const state = await read(tx, key), active = owned(state, claim)
    if (active.phase !== 'preparing' || active.requested !== request.to || request.pointsAt > now || now >= active.leaseUntil) throw new SeatOperationError('SEAT_OPERATION_STALE')
    const next: Updating = { ...active, phase: 'stripe', request: { ...request }, idempotencyKey: 'doya-seat-' + randomUUID(), firstSentAt: now, leaseUntil: now + LEASE_MS }
    await write(tx, key, { ...state, active: next })
    return { companyId: claim.companyId, token: next.token, active: next }
  })
}

/** Safe only before Stripe has been attempted. Unknown Stripe outcomes must
 * retain the durable claim; they cannot call this method to unlock admissions.
 */
export async function cancelSeatPreparation(claim: SeatOperationClaim, db: Db = prisma): Promise<void> {
  return guarded(claim.companyId, db, async (tx, key) => {
    const state = await read(tx, key), active = owned(state, claim)
    if (active.phase !== 'preparing') throw new SeatOperationError('SEAT_OPERATION_RECONCILE')
    await write(tx, key, { ...state, active: null })
  })
}

/** Refresh the old authoritative quantity before the existing monthly grant.
 * This writes only the cache, keeps admissions blocked and rejects a replaced
 * preparation token. No Stripe request may happen in this callback.
 */
export async function saveSeatPreparationCache(claim: SeatOperationClaim, save: (tx: Tx) => Promise<void>, db: Db = prisma, now = Date.now()): Promise<void> {
  return guarded(claim.companyId, db, async (tx, key) => {
    const state = await read(tx, key), active = owned(state, claim)
    if (active.phase !== 'preparing' || now >= active.leaseUntil) throw new SeatOperationError('SEAT_OPERATION_STALE')
    await save(tx)
    await write(tx, key, state)
  })
}

/** The ledger transaction is Serializable and may have taken its snapshot
 * before waiting for this advisory lock. Writing the state row forces a
 * serialization/unique conflict if that snapshot predates a seat operation;
 * the ledger retries the whole transaction and recalculates its amount.
 */
export async function withSeatMonthlyGrantInTransaction<T>(companyId: string, tx: Tx, work: () => Promise<T>): Promise<T | false> {
  const key = companyKey(companyId)
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('team-seat-operation:v1'), hashtext(${companyId}))`
  const state = await read(tx, key)
  if (state.active) return false
  await write(tx, key, state)
  return work()
}

/** The reservation owner's initial monthly grant is permitted while preparing,
 * but must prove the same token in the ledger transaction that writes points.
 * A stale Serializable snapshot is fenced by the state-row write as above.
 */
export async function seatPreparationGrantAllowed(claim: SeatOperationClaim, tx: Tx, now = Date.now()): Promise<boolean> {
  const key = companyKey(claim.companyId)
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('team-seat-operation:v1'), hashtext(${claim.companyId}))`
  const state = await read(tx, key), active = owned(state, claim)
  if (active.phase !== 'preparing' || now >= active.leaseUntil) throw new SeatOperationError('SEAT_OPERATION_STALE')
  await write(tx, key, state)
  return true
}

/** Only call after verifying the Stripe outcome and finishing idempotent point
 * grants. Persist the authoritative seat cache through `save` in the same SQL
 * transaction as the receipt and unlock. A failed cache write keeps the claim.
 */
export async function finishSeatOperation(claim: SeatOperationClaim, result: SeatOperationResult, save: (tx: Tx) => Promise<void>, db: Db = prisma): Promise<void> {
  if (!resultValid(result)) throw new Error('Invalid seat operation result')
  return guarded(claim.companyId, db, async (tx, key) => {
    const state = await read(tx, key), active = owned(state, claim)
    if (active.phase !== 'stripe' || result.seats !== active.requested) throw new SeatOperationError('SEAT_OPERATION_CONFLICT')
    await save(tx)
    const receiptKey = key + ':result:' + active.operationKey
    await tx.systemSetting.create({ data: { key: receiptKey, value: JSON.stringify({ requested: active.requested, result,
      ...(active.reconciliation ? { reconciliation: active.reconciliation } : {}),
    }) } })
    await write(tx, key, { ...state, active: null })
  })
}

/** Only for StripeCardError returned by error_if_incomplete. A timeout, 5xx,
 * quantity mismatch, or post-update failure is NOT proof of payment rejection.
 * Keep those reservations until a same-key retry or explicit reconciliation.
 */
export async function recordSeatPaymentRejection(claim: SeatOperationClaim, db: Db = prisma): Promise<void> {
  return guarded(claim.companyId, db, async (tx, key) => {
    const state = await read(tx, key), active = owned(state, claim)
    if (active.phase !== 'stripe' || active.request.direction !== 'up') throw new SeatOperationError('SEAT_OPERATION_RECONCILE')
    await tx.systemSetting.create({ data: {
      key: key + ':result:' + active.operationKey,
      value: JSON.stringify({ requested: active.requested, failure: 'PAYMENT_FAILED' }),
    } })
    await write(tx, key, { ...state, active: null })
  })
}

/** Owner context must supply company/op/quantity. This reads the persisted
 * claim without changing it, before the read-only Stripe evidence lookup.
 */
export async function inspectSeatReconciliation(companyId: string, operationKey: string, requested: number, db: Db = prisma, now = Date.now()): Promise<SeatOperationClaim> {
  if (!isValidOperationKey(operationKey) || !seatCount(requested) || !timestamp(now)) throw new Error('Invalid reconciliation input')
  return guarded(companyId, db, async (tx, key) => {
    const state = await read(tx, key), active = state.active
    if (!active || active.phase !== 'stripe' || active.operationKey !== operationKey || active.requested !== requested) throw new SeatOperationError('SEAT_OPERATION_CONFLICT')
    if (now < active.firstSentAt || now - active.firstSentAt < RETRY_WINDOW_MS || now < active.leaseUntil) throw new SeatOperationError('SEAT_OPERATION_BUSY')
    return { companyId, token: active.token, active }
  })
}

/** Internal only: proof must come from readSeatReconciliationEvidence, never an
 * HTTP body. Rotate the token after lookup so a concurrent worker cannot also
 * publish its cache. This claim is for local completion, NOT another Stripe POST.
 */
export async function claimVerifiedSeatReconciliation(snapshot: SeatOperationClaim, proof: Extract<SeatReconciliationProof, { ok: true }>, db: Db = prisma, now = Date.now()): Promise<SeatOperationClaim> {
  if (!timestamp(now) || !timestamp(now + LEASE_MS) || !proof.ok || !opaque(proof.eventId) || !proof.eventId.startsWith('evt_') ||
    (proof.invoiceId !== null && (!opaque(proof.invoiceId) || !proof.invoiceId.startsWith('in_')))) throw new Error('Invalid reconciliation proof')
  return guarded(snapshot.companyId, db, async (tx, key) => {
    const state = await read(tx, key), active = owned(state, snapshot)
    if (active.phase !== 'stripe' || snapshot.active.phase !== 'stripe' || active.idempotencyKey !== snapshot.active.idempotencyKey || JSON.stringify(active.request) !== JSON.stringify(snapshot.active.request)) throw new SeatOperationError('SEAT_OPERATION_STALE')
    if (now < active.firstSentAt || now - active.firstSentAt < RETRY_WINDOW_MS || now < active.leaseUntil) throw new SeatOperationError('SEAT_OPERATION_BUSY')
    if ((active.request.direction === 'up') !== (proof.invoiceId !== null)) throw new SeatOperationError('SEAT_OPERATION_CONFLICT')
    const next: Updating = { ...active, token: randomUUID(), leaseUntil: now + LEASE_MS,
      reconciliation: { eventId: proof.eventId, invoiceId: proof.invoiceId, verifiedAt: now } }
    await write(tx, key, { ...state, active: next })
    return { companyId: snapshot.companyId, token: next.token, active: next }
  })
}

/** A GET/refresh obtains a revision before reading Stripe, then conditionally
 * saves its cache. A seat operation or admission invalidates that revision.
 */
export async function seatCacheRevision(companyId: string, db: Db = prisma): Promise<number> {
  return guarded(companyId, db, async (tx, key) => {
    const state = await read(tx, key)
    if (state.active) throw new SeatOperationError('SEAT_OPERATION_BUSY')
    return state.revision
  })
}
export async function saveSeatCacheAtRevision(companyId: string, revision: number, save: (tx: Tx) => Promise<void>, db: Db = prisma): Promise<void> {
  if (!timestamp(revision)) throw new Error('Invalid seat cache revision')
  return guarded(companyId, db, async (tx, key) => {
    const state = await read(tx, key)
    if (state.active || state.revision !== revision) throw new SeatOperationError('SEAT_OPERATION_STALE')
    await save(tx)
    await write(tx, key, state)
  })
}
