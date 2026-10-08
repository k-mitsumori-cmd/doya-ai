import { createHash } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { DOYALIST_LIMITS, monthlyCompanyWhere, monthStart } from './limits'
import { tierFrom } from '@/lib/plan-utils'
import { parseDoyalistProjectInput } from './project-input'

type Identity = { userId: string; operationId: string }
type Phase = 'ready' | 'pending' | 'cancelling' | 'completed' | 'failed' | 'cancelled'
type CollectionFailure = 'GENERATION_FAILED' | 'no_hits' | 'api_error' | 'collection_timeout'
type Code = CollectionFailure | 'MONTHLY_LIMIT_REACHED' | 'MONTHLY_REQUEST_EXCEEDS_REMAINING' | 'CAPACITY_RESERVED' | 'GENERATION_FAILED' | 'OPERATION_EXPIRED' | null
type Receipt = Identity & {
  version: 1; projectId: string | null; fingerprint: string | null; selectionFingerprint: string | null; count: number
  phase: Phase; startedAt: string; month: string | null; held: number
  limit: number | null; ids: string[]; warning: string | null; code: Code
}
export type DoyalistExtraction = {
  operationId: string; projectId: string | null; state: Phase | 'missing' | 'started' | 'busy'
  count: number; generated: number; limit: number | null; warning: string | null; code: Code
}
type Db = Pick<typeof prisma, '$transaction'>
const id = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(v)
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex')
const selectionHash = (project: { industry: string | null; region: string | null; targetSize: string | null; keywords: string | null }) => hash([project.industry, project.region, project.targetSize, project.keywords])
const prefix = (i: Identity) => 'doyalist-extraction:v1:' + hash(i.userId) + ':'
const key = (i: Identity) => prefix(i) + i.operationId
const activePrefix = (i: Identity) => 'doyalist-extraction-active:v1:' + hash(i.userId) + ':'
const activeKey = (i: Identity) => activePrefix(i) + i.operationId
export const DOYALIST_EXTRACTION_LEASE_MS = 10 * 60 * 1000
const options = { isolationLevel: 'ReadCommitted' as const, maxWait: 10_000, timeout: 30_000 }

export class DoyalistExtractionError extends Error {
  constructor(readonly code: string, readonly status = 409) {
    super('抽出の保存状況を確認できません。新しく抽出せず、保存結果を確認してください。')
  }
}
function identity(i: Identity): Identity {
  if (!i || !id(i.userId) || typeof i.operationId !== 'string' || !uuid.test(i.operationId)) throw new DoyalistExtractionError('INVALID_OPERATION', 400)
  return { userId: i.userId, operationId: i.operationId.toLowerCase() }
}
function validTime(now: Date) {
  if (!Number.isFinite(now.getTime())) throw new DoyalistExtractionError('INVALID_OPERATION', 400)
}
function parse(raw: string, expected: Identity): Receipt {
  try {
    if (Buffer.byteLength(raw) > 2 * 1024 * 1024) throw new Error()
    const r: Receipt = JSON.parse(raw), i = identity(r)
    if (r.version !== 1 || i.userId !== expected.userId || i.operationId !== expected.operationId || r.operationId !== i.operationId
      || !['ready', 'pending', 'cancelling', 'completed', 'failed', 'cancelled'].includes(r.phase)
      || !Number.isSafeInteger(r.count) || r.count < 0 || r.count > 10_000
      || typeof r.startedAt !== 'string' || !Number.isFinite(Date.parse(r.startedAt))
      || ![null, 'MONTHLY_LIMIT_REACHED', 'MONTHLY_REQUEST_EXCEEDS_REMAINING', 'CAPACITY_RESERVED', 'GENERATION_FAILED', 'OPERATION_EXPIRED', 'no_hits', 'api_error', 'collection_timeout'].includes(r.code)
      || (r.warning !== null && (typeof r.warning !== 'string' || r.warning.length > 5000))
      || (r.limit !== null && (!Number.isSafeInteger(r.limit) || r.limit < -1))
      || !Array.isArray(r.ids) || r.ids.length > r.count || r.ids.some(v => !id(v)) || new Set(r.ids).size !== r.ids.length) throw new Error()
    const tombstone = r.fingerprint === null
    if (tombstone ? r.phase !== 'cancelled' || r.projectId !== null || r.count !== 0 || r.selectionFingerprint !== null :
      typeof r.fingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(r.fingerprint) || typeof r.selectionFingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(r.selectionFingerprint) || !id(r.projectId) || r.count === 0) throw new Error()
    if (r.month !== null && (typeof r.month !== 'string' || !Number.isFinite(Date.parse(r.month)) || monthStart(new Date(r.month)).toISOString() !== r.month)) throw new Error()
    if (r.phase === 'pending' || r.phase === 'cancelling') {
      if (r.held !== r.count || r.month === null || r.limit === null || r.code !== null) throw new Error()
    } else if (r.held !== 0) throw new Error()
    if (r.phase === 'completed' ? r.ids.length === 0 || r.code !== null || r.month === null || r.limit === null : r.ids.length !== 0 || r.warning !== null) throw new Error()
    if (r.phase === 'failed' ? r.code === null : r.code !== null) throw new Error()
    return r
  } catch { throw new DoyalistExtractionError('INVALID_RECEIPT') }
}
async function read(tx: Prisma.TransactionClient, i: Identity) {
  const row = await tx.systemSetting.findUnique({ where: { key: key(i) }, select: { value: true } })
  return row ? parse(row.value, i) : null
}
async function write(tx: Prisma.TransactionClient, r: Receipt) {
  const value = JSON.stringify(r); parse(value, r)
  await tx.systemSetting.upsert({ where: { key: key(r) }, create: { key: key(r), value }, update: { value } })
}
const dto = (i: Identity, r: Receipt | null, state?: DoyalistExtraction['state']): DoyalistExtraction => ({
  operationId: i.operationId, projectId: r?.projectId || null, state: state || r?.phase || 'missing',
  count: r?.count || 0, generated: r?.ids.length || 0, limit: r?.limit ?? null, warning: r?.warning || null, code: r?.code || null,
})
async function terminal(tx: Prisma.TransactionClient, r: Receipt, phase: 'failed' | 'cancelled', code: Code) {
  const next: Receipt = { ...r, phase, held: 0, code, ids: [], warning: null }
  await write(tx, next)
  await tx.systemSetting.deleteMany({ where: { key: activeKey(r), value: key(r) } })
  return next
}
async function verifyActive(tx: Prisma.TransactionClient, r: Receipt) {
  if (r.phase !== 'pending' && r.phase !== 'cancelling') return
  const row = await tx.systemSetting.findUnique({ where: { key: activeKey(r) }, select: { value: true } })
  if (row?.value !== key(r)) throw new DoyalistExtractionError('INVALID_RECEIPT')
}
async function expire(tx: Prisma.TransactionClient, r: Receipt, now: Date) {
  await verifyActive(tx, r)
  if (!['ready', 'pending', 'cancelling'].includes(r.phase) || now.getTime() - Date.parse(r.startedAt) < DOYALIST_EXTRACTION_LEASE_MS) return r
  return terminal(tx, r, r.phase === 'cancelling' ? 'cancelled' : 'failed', r.phase === 'cancelling' ? null : 'OPERATION_EXPIRED')
}
async function ownedProject(tx: Prisma.TransactionClient, i: Identity, projectId: string) {
  await tx.$queryRaw`SELECT id FROM doyalist_projects WHERE id = ${projectId} FOR UPDATE`
  const project = await tx.doyalistProject.findUnique({ where: { id: projectId } })
  if (!project || project.userId !== i.userId || project.status === 'archived') throw new DoyalistExtractionError('PROJECT_UNAVAILABLE', 404)
  return project
}
async function verifyCompleted(tx: Prisma.TransactionClient, i: Identity, r: Receipt) {
  if (r.phase !== 'completed') return
  await ownedProject(tx, i, r.projectId!)
  const count = await tx.doyalistCompany.count({ where: { id: { in: r.ids }, projectId: r.projectId! } })
  if (count !== r.ids.length) throw new DoyalistExtractionError('RESULT_UNAVAILABLE', 410)
}
async function transaction<T>(i: Identity, db: Db, work: (tx: Prisma.TransactionClient, plan: unknown) => Promise<T>) {
  return db.$transaction(async tx => {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "User" WHERE id = ${i.userId} FOR UPDATE`
    if (rows.length !== 1) throw new DoyalistExtractionError('ACTOR_UNAVAILABLE', 401)
    const user = await tx.user.findUnique({ where: { id: i.userId }, select: { plan: true } })
    if (!user) throw new DoyalistExtractionError('ACTOR_UNAVAILABLE', 401)
    return work(tx, user.plan)
  }, options)
}
async function available(tx: Prisma.TransactionClient, i: Identity, plan: unknown, now: Date, exclude?: string) {
  const active = await tx.systemSetting.findMany({ where: { key: { startsWith: activePrefix(i) } }, select: { key: true, value: true }, take: 10_001 })
  if (active.length > 10_000) throw new DoyalistExtractionError('OPERATION_CAPACITY', 503)
  let held = 0
  const month = monthStart(now).toISOString()
  for (const pointer of active) {
    const operationId = pointer.key.slice(activePrefix(i).length), otherIdentity = identity({ ...i, operationId })
    if (pointer.value !== key(otherIdentity)) throw new DoyalistExtractionError('INVALID_RECEIPT')
    const other = await read(tx, otherIdentity)
    if (!other || !['pending', 'cancelling'].includes(other.phase)) throw new DoyalistExtractionError('INVALID_RECEIPT')
    const current = await expire(tx, other, now)
    if (operationId !== exclude && current.month === month) held += current.held
  }
  const limit = DOYALIST_LIMITS[tierFrom(plan)].maxCompaniesPerMonth
  const used = await tx.doyalistCompany.count({ where: monthlyCompanyWhere(i.userId, now) })
  return { month, limit, used, held, remaining: limit < 0 ? -1 : Math.max(0, limit - used - held) }
}

/** The project and its receipt are one commit, so a lost creation response cannot create another. */
export async function prepareDoyalistExtraction(
  input: Identity & { count: number; projectId?: string; project?: Record<string, unknown> }, db: Db = prisma, now = new Date(),
): Promise<DoyalistExtraction> {
  const i = identity(input); validTime(now)
  if (!Number.isSafeInteger(input.count) || input.count < 1 || input.count > 10_000 || (!!input.projectId === !!input.project)) throw new DoyalistExtractionError('INVALID_OPERATION', 400)
  if (input.projectId && !id(input.projectId)) throw new DoyalistExtractionError('INVALID_OPERATION', 400)
  const parsed = input.project ? parseDoyalistProjectInput(input.project, 'create') : null
  if (parsed && !parsed.ok) throw new DoyalistExtractionError('INVALID_OPERATION', 400)
  const projectData = parsed?.ok ? parsed.data : null
  const fingerprint = hash([input.projectId || null, projectData ? [projectData.name, ...['description', 'industry', 'region', 'targetSize', 'keywords'].map(k => projectData[k as keyof typeof projectData] || null)] : null, input.count])
  return transaction(i, db, async (tx, plan) => {
    const previous = await read(tx, i)
    if (previous) {
      if (previous.fingerprint !== null && previous.fingerprint !== fingerprint) throw new DoyalistExtractionError('INPUT_CHANGED')
      await verifyCompleted(tx, i, previous)
      return dto(i, await expire(tx, previous, now))
    }
    const limits = DOYALIST_LIMITS[tierFrom(plan)]
    if (limits.maxProjects === 0) throw new DoyalistExtractionError('PROJECT_LIMIT_REACHED', 403)
    if (!input.projectId && limits.maxProjects > 0 && await tx.doyalistProject.count({ where: { userId: i.userId, status: { not: 'archived' } } }) >= limits.maxProjects) throw new DoyalistExtractionError('PROJECT_LIMIT_REACHED', 403)
    const project = input.projectId ? await ownedProject(tx, i, input.projectId) : await tx.doyalistProject.create({ data: {
      userId: i.userId, name: projectData!.name!, description: projectData!.description || null,
      industry: projectData!.industry || null, region: projectData!.region || null,
      targetSize: projectData!.targetSize || null, keywords: projectData!.keywords || null, status: 'active',
    } })
    const receipt: Receipt = { ...i, version: 1, projectId: project.id, fingerprint, selectionFingerprint: selectionHash(project), count: input.count, phase: 'ready',
      startedAt: now.toISOString(), month: null, held: 0, limit: null, ids: [], warning: null, code: null }
    await write(tx, receipt); return dto(i, receipt)
  })
}

/** Account-wide held capacity preserves parallel extractions without overbooking the month. */
export async function beginDoyalistExtraction(input: Identity & { projectId: string; count: number; selection?: { industry: string | null; region: string | null; targetSize: string | null; keywords: string | null } }, db: Db = prisma, now = new Date()): Promise<DoyalistExtraction> {
  const i = identity(input); validTime(now)
  return transaction(i, db, async (tx, plan) => {
    let r = await read(tx, i)
    if (!r) throw new DoyalistExtractionError('OPERATION_MISSING')
    if (r.projectId !== input.projectId || r.count !== input.count) throw new DoyalistExtractionError('INPUT_CHANGED')
    r = await expire(tx, r, now)
    if (r.phase !== 'ready') { await verifyCompleted(tx, i, r); return dto(i, r) }
    const project = await ownedProject(tx, i, input.projectId)
    // The provider must use the same snapshot that this admission validates.
    // A project changed and restored before this lock must not admit a stale route read.
    if (selectionHash(project) !== r.selectionFingerprint || (input.selection && selectionHash(input.selection) !== r.selectionFingerprint)) throw new DoyalistExtractionError('INPUT_CHANGED')
    const { month, limit, used, remaining } = await available(tx, i, plan, now)
    if (limit >= 0 && r.count > remaining) {
      // Work in another tab has not consumed usage yet. Keep this receipt ready
      // for explicit resume instead of incorrectly sending the user to billing.
      if (r.count <= Math.max(0, limit - used)) return dto(i, { ...r, limit }, 'busy')
      return dto(i, await terminal(tx, { ...r, limit }, 'failed', used >= limit ? 'MONTHLY_LIMIT_REACHED' : 'MONTHLY_REQUEST_EXCEEDS_REMAINING'))
    }
    r = { ...r, phase: 'pending', startedAt: now.toISOString(), month, held: r.count, limit }
    await write(tx, r)
    await tx.systemSetting.upsert({ where: { key: activeKey(i) }, create: { key: activeKey(i), value: key(i) }, update: { value: key(i) } })
    return dto(i, r, 'started')
  })
}

/** Read/cancel does not invoke collection. Pending cancellation retains held capacity until worker exit. */
export async function recoverDoyalistExtraction(input: Identity, cancel = false, db: Db = prisma, now = new Date()): Promise<DoyalistExtraction> {
  const i = identity(input); validTime(now)
  return transaction(i, db, async tx => {
    let r = await read(tx, i)
    if (r) r = await expire(tx, r, now)
    if (cancel && !r) {
      r = { ...i, version: 1, projectId: null, fingerprint: null, selectionFingerprint: null, count: 0, phase: 'cancelled', startedAt: now.toISOString(), month: null, held: 0, limit: null, ids: [], warning: null, code: null }
      await write(tx, r)
    } else if (cancel && r?.phase === 'ready') r = await terminal(tx, r, 'cancelled', null)
    else if (cancel && r?.phase === 'pending') { r = { ...r, phase: 'cancelling' }; await write(tx, r) }
    if (r) await verifyCompleted(tx, i, r)
    return dto(i, r)
  })
}

export async function failDoyalistExtraction(input: Identity, db: Db = prisma, now = new Date(), code: CollectionFailure = 'GENERATION_FAILED'): Promise<DoyalistExtraction> {
  const i = identity(input); validTime(now)
  return transaction(i, db, async tx => {
    const r = await read(tx, i)
    if (!r) throw new DoyalistExtractionError('OPERATION_MISSING')
    await verifyActive(tx, r)
    return dto(i, r.phase === 'pending' || r.phase === 'cancelling'
      ? await terminal(tx, r, r.phase === 'cancelling' ? 'cancelled' : 'failed', r.phase === 'cancelling' ? null : code) : r)
  })
}

/** Company insert and completion acknowledgement commit together; a terminal replay never runs save. */
export async function completeDoyalistExtraction(
  input: Identity, save: (tx: Prisma.TransactionClient, projectId: string, count: number) => Promise<{ ids: string[]; warning?: string }>, db: Db = prisma, now = new Date(),
): Promise<DoyalistExtraction> {
  const i = identity(input); validTime(now)
  return transaction(i, db, async (tx, plan) => {
    let r = await read(tx, i)
    if (!r) throw new DoyalistExtractionError('OPERATION_MISSING')
    r = await expire(tx, r, now)
    if (r.phase === 'cancelling') return dto(i, await terminal(tx, r, 'cancelled', null))
    if (r.phase !== 'pending') { await verifyCompleted(tx, i, r); return dto(i, r) }
    const project = await ownedProject(tx, i, r.projectId!)
    if (selectionHash(project) !== r.selectionFingerprint) throw new DoyalistExtractionError('INPUT_CHANGED')
    // A month boundary or plan downgrade may change capacity while providers run.
    const { limit, used, held, remaining } = await available(tx, i, plan, now, i.operationId)
    if (remaining === 0) return dto(i, await terminal(tx, { ...r, limit }, 'failed', held > 0 && used < limit ? 'CAPACITY_RESERVED' : 'MONTHLY_LIMIT_REACHED'))
    const allowed = remaining < 0 ? r.count : Math.min(r.count, remaining)
    const result = await save(tx, r.projectId!, allowed)
    if (!Array.isArray(result.ids) || !result.ids.length || result.ids.length > allowed || result.ids.some(v => !id(v)) || new Set(result.ids).size !== result.ids.length) throw new DoyalistExtractionError('INVALID_RESULT')
    const saved = await tx.doyalistCompany.count({ where: { ...monthlyCompanyWhere(i.userId, now), id: { in: result.ids }, projectId: r.projectId! } })
    if (saved !== result.ids.length) throw new DoyalistExtractionError('INVALID_RESULT')
    const warning = [result.warning, allowed < r.count ? `利用枠の変更により、今月の残り枠の範囲で${result.ids.length}社を保存しました。` : null].filter(Boolean).join(' ') || null
    r = { ...r, phase: 'completed', held: 0, month: monthStart(now).toISOString(), limit, ids: result.ids, warning }
    await write(tx, r)
    await tx.systemSetting.deleteMany({ where: { key: activeKey(i), value: key(i) } })
    return dto(i, r)
  })
}

/** Recover only this receipt's saved companies, never unrelated later extractions. */
export async function readDoyalistExtractionResult(input: Identity, db: Db = prisma, now = new Date()) {
  const i = identity(input); validTime(now)
  return transaction(i, db, async tx => {
    const previous = await read(tx, i)
    const r = previous ? await expire(tx, previous, now) : null
    if (r) await verifyCompleted(tx, i, r)
    const companies = r?.phase === 'completed'
      ? await tx.doyalistCompany.findMany({ where: { id: { in: r.ids }, projectId: r.projectId! } }) : []
    const byId = new Map(companies.map(company => [company.id, company]))
    return { operation: dto(i, r), companies: r?.phase === 'completed' ? r.ids.map(id => byId.get(id)!) : [] }
  })
}
