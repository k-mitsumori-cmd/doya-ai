import { createHash, randomUUID } from 'node:crypto'
import { Prisma, type PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { assertLifecycleWritable } from '@/lib/account-lifecycle/store'
import { assertLimitForTier } from '@/lib/plan-limit'
import { planTierOf } from '@/lib/plan-limit'
import { boothSize, expectedVisitors, type ProjectInput, type SiteAnalysis } from './engine'
import { generationReceiptPrefix, TENJIKAI_GENERATION_PREFIX } from './generation-receipts'
import { advanceTenjikaiRevision, lockOwnedTenjikaiRevision, lockTenjikaiActor, parseTenjikaiRevision, TenjikaiRevisionError } from './project-revision'
import { readFullTenjikaiWorkspaceTx, writeInitialTenjikaiWorkspace } from './workspace-store'
import type { MaterializedWorkspace } from './workspace-materialize'
import type { FullTenjikaiWorkspace } from './workspace-dto'

const PREFIX = TENJIKAI_GENERATION_PREFIX
const OWNER_PREFIX = 'tenjikai-generate-owner:v1:'
const ADMISSION_MS = 24 * 60 * 60 * 1000
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000
const MAX_RECEIPTS = 512
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const options = { isolationLevel: 'Serializable' as const, maxWait: 10000, timeout: 20000 }
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const actorHash = (actor: string) => hash(actor)
const safeActor = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(v)
const validIso = (v: unknown): v is string => typeof v === 'string' && Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
export type OperationPhase = 'reserved' | 'claimed' | 'completed' | 'degraded' | 'failed' | 'canceled' | 'superseded'
type ReceiptBase = { actorHash: string; operationId: string; fingerprint: string | null; projectId: string | null; projectHash: string | null; claim: string | null; phase: OperationPhase; createdAt: string; claimedAt: string | null; settledAt: string | null; analysis: 'saved' | 'not_saved' | 'unknown'; code: 'NONE' | 'GENERATION_FAILED' | 'ANALYSIS_UNKNOWN' | 'CANCELED' | 'SUPERSEDED' }
type LegacyReceipt = ReceiptBase & { version: 1 }
type RevisionReceipt = ReceiptBase & { version: 2; baseRevision: string | null; resultRevision: string | null }
type Receipt = LegacyReceipt | RevisionReceipt
export type GenerationOperation = { operationId: string; state: Exclude<OperationPhase, 'claimed'> | 'processing' | 'missing' | 'unknown' | 'deleted'; projectId: string | null; analysis: Receipt['analysis']; code: Receipt['code']; dispatchAllowed: boolean; terminalConfirmed?: boolean }
export type GenerationClaim = { actor: string; operationId: string; fingerprint: string; projectId: string; projectHash: string; token: string; baseRevision: string }
export type GenerationAdmission = { operation: GenerationOperation; claim: GenerationClaim | null; quota?: Awaited<ReturnType<typeof assertLimitForTier>> }
export class GenerationOperationError extends Error { constructor(readonly status: number, readonly code: string) { super('生成操作の状態を確認できません。') } }
export function createGenerationOperationId(now = new Date()) { return `${now.getTime()}.${randomUUID()}` }
export function validGenerationOperationId(v: unknown): v is string { return typeof v === 'string' && /^\d{13}\.[0-9a-f-]{36}$/i.test(v) && uuid.test(v.slice(14)) }
function identity(actor: string, operationId: string) {
  if (!safeActor(actor) || !validGenerationOperationId(operationId)) throw new GenerationOperationError(400, 'INVALID_OPERATION')
  return { actor, operationId: operationId.toLowerCase() }
}
function operationTime(operationId: string, now: Date) {
  const t = Number(operationId.slice(0, 13))
  if (!Number.isSafeInteger(t) || t > now.getTime() + 300_000) throw new GenerationOperationError(400, 'INVALID_OPERATION')
  return t
}
function key(actor: string, operationId: string) { return PREFIX + actorHash(actor) + ':' + operationId }
function ownerKey(operationId: string) { return OWNER_PREFIX + operationId }
/** The actor User lock is already held. A global operation ID may have only one owner. */
async function owner(tx: Prisma.TransactionClient, actor: string, operationId: string) {
  await tx.$queryRaw`SELECT 1::integer FROM pg_advisory_xact_lock(hashtext(${operationId})::bigint)`
  const row = await tx.systemSetting.findUnique({ where: { key: ownerKey(operationId) }, select: { value: true } })
  if (row && row.value !== actorHash(actor)) throw new GenerationOperationError(409, 'FOREIGN_OPERATION')
  return !!row
}
async function lockOwnedProject(tx: Prisma.TransactionClient, actor: string, projectId: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM tenjikai_project WHERE id = ${projectId} AND "userId" = ${actor} FOR UPDATE`
  return rows.some(row => row.id === projectId)
}
export function generationInputFingerprint(input: ProjectInput) {
  return hash([input.serviceUrl, input.eventName, input.venueId, input.eventStart, input.days, input.komaCols, input.komaRows, input.position, input.budgetYen, input.goal, input.staff])
}
type ProjectSource = { id: string; serviceUrl: string; eventName: string; eventStart: Date; eventDays: number; komaCols: number; komaRows: number; boothPosition: string; budgetYen: number; goal: string; staffCount: number }
function projectHash(row: ProjectSource) { return hash([row.id, row.serviceUrl, row.eventName, row.eventStart.toISOString(), row.eventDays, row.komaCols, row.komaRows, row.boothPosition, row.budgetYen, row.goal, row.staffCount]) }
const projectSelect = { id: true, serviceUrl: true, eventName: true, eventStart: true, eventDays: true, komaCols: true, komaRows: true, boothPosition: true, budgetYen: true, goal: true, staffCount: true } as const
function receipt(raw: string, actor: string, operationId: string): Receipt {
  try {
    if (Buffer.byteLength(raw) > 4096) throw Error()
    const r: unknown = JSON.parse(raw)
    if (!object(r) || (r.version !== 1 && r.version !== 2) || Object.keys(r).sort().join(',') !== (r.version === 1 ? 'actorHash,analysis,claim,claimedAt,code,createdAt,fingerprint,operationId,phase,projectHash,projectId,settledAt,version' : 'actorHash,analysis,baseRevision,claim,claimedAt,code,createdAt,fingerprint,operationId,phase,projectHash,projectId,resultRevision,settledAt,version') || r.actorHash !== actorHash(actor) || r.operationId !== operationId || !validIso(r.createdAt) || !['reserved', 'claimed', 'completed', 'degraded', 'failed', 'canceled', 'superseded'].includes(String(r.phase)) ||
      !(r.fingerprint === null || typeof r.fingerprint === 'string' && /^[0-9a-f]{64}$/.test(r.fingerprint)) || !(r.projectId === null || typeof r.projectId === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(r.projectId)) || !(r.projectHash === null || typeof r.projectHash === 'string' && /^[0-9a-f]{64}$/.test(r.projectHash)) || !(r.claim === null || typeof r.claim === 'string' && uuid.test(r.claim)) || !(r.claimedAt === null || validIso(r.claimedAt)) || !(r.settledAt === null || validIso(r.settledAt)) || !['saved', 'not_saved', 'unknown'].includes(String(r.analysis)) || !['NONE', 'GENERATION_FAILED', 'ANALYSIS_UNKNOWN', 'CANCELED', 'SUPERSEDED'].includes(String(r.code))) throw Error()
    const v = r as Receipt
    if (v.version === 2 && (v.baseRevision !== null && (typeof v.baseRevision !== 'string' || parseTenjikaiRevision(v.baseRevision) < 0n) || v.resultRevision !== null && (typeof v.resultRevision !== 'string' || parseTenjikaiRevision(v.resultRevision) < 0n) || (v.projectId === null) !== (v.baseRevision === null) || v.phase === 'completed' && (v.baseRevision === null || v.resultRevision !== (BigInt(v.baseRevision) + 1n).toString()) || v.phase !== 'completed' && v.resultRevision !== null)) throw Error()
    if (v.phase === 'canceled' && (Boolean(v.fingerprint) !== Boolean(v.projectId) || Boolean(v.projectId) !== Boolean(v.projectHash) || v.claim || v.claimedAt || v.analysis !== 'not_saved' || v.code !== 'CANCELED') ||
      v.phase !== 'canceled' && (!v.fingerprint || !v.projectId || !v.projectHash) ||
      v.phase === 'reserved' && (v.claim || v.claimedAt || v.settledAt || v.code !== 'NONE') ||
      v.phase === 'claimed' && (!v.claim || !v.claimedAt || v.settledAt || v.code !== 'NONE') ||
      ['completed', 'degraded', 'failed'].includes(v.phase) && (!v.claim || !v.claimedAt || !v.settledAt) ||
      (v.phase === 'completed' && v.analysis !== 'saved') ||
      v.phase === 'superseded' && !v.settledAt) throw Error()
    return v
  } catch { throw new GenerationOperationError(409, 'INVALID_RECEIPT') }
}
async function read(tx: Prisma.TransactionClient, actor: string, operationId: string) {
  const row = await tx.systemSetting.findUnique({ where: { key: key(actor, operationId) }, select: { value: true } })
  return row ? { raw: row.value, value: receipt(row.value, actor, operationId) } : null
}
async function write(tx: Prisma.TransactionClient, actor: string, operationId: string, next: Receipt, old: string | null) {
  const value = JSON.stringify(next); receipt(value, actor, operationId)
  if (old === null) {
    await tx.systemSetting.create({ data: { key: ownerKey(operationId), value: actorHash(actor) } })
    await tx.systemSetting.create({ data: { key: key(actor, operationId), value } })
  }
  else if ((await tx.systemSetting.updateMany({ where: { key: key(actor, operationId), value: old }, data: { value } })).count !== 1) throw new GenerationOperationError(409, 'OPERATION_CHANGED')
}
async function view(tx: Prisma.TransactionClient, actor: string, operationId: string, r: Receipt | null, now: Date): Promise<GenerationOperation> {
  if (!r) return { operationId, state: 'missing', projectId: null, analysis: 'not_saved', code: 'NONE', dispatchAllowed: false }
  const owned = r.projectId ? await lockOwnedProject(tx, actor, r.projectId) : false
  const project = owned ? await tx.tenjikaiProject.findFirst({ where: { id: r.projectId!, userId: actor }, select: projectSelect }) : null
  const savedAnalysis = r.phase === 'completed' && project ? await tx.tenjikaiSiteAnalysis.findUnique({ where: { projectId: project.id }, select: { projectId: true } }) : null
  const analysisMissing = r.phase === 'completed' && !savedAnalysis
  const revisionRows = r.version === 2 && project ? await tx.$queryRaw<Array<{ revision: bigint }>>`SELECT revision FROM tenjikai_project WHERE id = ${project.id} AND "userId" = ${actor}` : []
  const expected = r.version === 2 ? r.resultRevision ?? r.baseRevision : null
  const revisionChanged = r.version === 2 && !!project && (revisionRows.length !== 1 || expected === null || revisionRows[0].revision.toString() !== expected)
  const state = r.projectId && !project ? 'deleted' : project && (projectHash(project) !== r.projectHash || analysisMissing || revisionChanged) ? 'superseded' : r.phase === 'claimed' ? now.getTime() - Date.parse(r.claimedAt!) >= 150_000 ? 'unknown' : 'processing' : r.phase
  // A later legitimate workspace CAS changes the derived view to superseded.
  // The validated, owned receipt phase still proves that this ID cannot dispatch again.
  const terminalConfirmed = ['completed', 'degraded', 'failed', 'canceled'].includes(r.phase) &&
    (r.phase === 'canceled' || !!project)
  return { operationId, state, projectId: project?.id ?? null, analysis: analysisMissing ? 'unknown' : r.analysis, code: r.code,
    dispatchAllowed: r.version === 2 && state === 'reserved' && !!project, terminalConfirmed }
}
async function txRetry<T>(db: Pick<PrismaClient, '$transaction'>, work: (tx: Prisma.TransactionClient) => Promise<T>) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try { return await db.$transaction(work, options) }
    catch (e) {
      const err = e as { code?: string; meta?: { code?: string } }
      if (!(err.code === 'P2034' || err.code === 'P2010' && ['40001', '40P01'].includes(err.meta?.code ?? '')) || attempt === 4) throw e
    }
  }
  throw new GenerationOperationError(503, 'TRANSACTION_UNAVAILABLE')
}
async function authority(tx: Prisma.TransactionClient, actor: string) { await lockTenjikaiActor(tx, actor) }
/** Actor-scoped bounded collection. Claimed/unknown work is never made eligible by age. */
async function collectTerminalForActor(tx: Prisma.TransactionClient, actor: string, now: Date) {
  const prefix = generationReceiptPrefix(actor)
  const rows = await tx.systemSetting.findMany({ where: { key: { startsWith: prefix } }, orderBy: { key: 'asc' }, take: MAX_RECEIPTS + 1, select: { key: true, value: true } })
  if (rows.length > MAX_RECEIPTS) throw new GenerationOperationError(503, 'RECEIPT_CAPACITY_UNKNOWN')
  for (const row of rows) {
    const id = row.key.slice(prefix.length)
    if (!validGenerationOperationId(id)) throw new GenerationOperationError(409, 'INVALID_RECEIPT')
    const r = receipt(row.value, actor, id)
    if (['reserved', 'claimed'].includes(r.phase) || now.getTime() - Date.parse(r.createdAt) < RETENTION_MS) continue
    // ID-based admission has expired long before this point. Late finalize sees missing and refuses.
    if (now.getTime() - operationTime(id, now) < ADMISSION_MS) throw new GenerationOperationError(409, 'OPERATION_NOT_EXPIRED')
    if (!await owner(tx, actor, id)) throw new GenerationOperationError(409, 'OWNER_INDEX_MISSING')
    if ((await tx.systemSetting.deleteMany({ where: { key: row.key, value: row.value } })).count !== 1) throw new GenerationOperationError(409, 'OPERATION_CHANGED')
    if ((await tx.systemSetting.deleteMany({ where: { key: ownerKey(id), value: actorHash(actor) } })).count !== 1) throw new GenerationOperationError(409, 'OWNER_INDEX_CHANGED')
  }
}
export async function admitGeneration(actor: string, operationId: string, input: ProjectInput, db: Pick<PrismaClient, '$transaction'> = prisma, now = new Date()): Promise<GenerationAdmission> {
  const i = identity(actor, operationId), t = operationTime(i.operationId, now), fingerprint = generationInputFingerprint(input)
  return txRetry(db, async tx => {
    await authority(tx, i.actor)
    const hasOwner = await owner(tx, i.actor, i.operationId)
    const existing = await read(tx, i.actor, i.operationId)
    if (hasOwner !== !!existing) throw new GenerationOperationError(409, 'OWNER_INDEX_ORPHAN')
    if (existing) {
      if (existing.value.fingerprint !== null && existing.value.fingerprint !== fingerprint) throw new GenerationOperationError(409, 'INPUT_CHANGED')
      return { operation: await view(tx, i.actor, i.operationId, existing.value, now), claim: null }
    }
    if (now.getTime() - t >= ADMISSION_MS) throw new GenerationOperationError(409, 'OPERATION_EXPIRED')
    await collectTerminalForActor(tx, i.actor, now)
    if (await tx.systemSetting.count({ where: { key: { startsWith: generationReceiptPrefix(i.actor) } } }) >= MAX_RECEIPTS) throw new GenerationOperationError(503, 'RECEIPT_CAPACITY_UNKNOWN')
    const tier = await planTierOf(i.actor, tx)
    const quota = await assertLimitForTier('tenjikaiPlans', tier, () => tx.tenjikaiProject.count({ where: { userId: i.actor } }), since => tx.tenjikaiProject.count({ where: { userId: i.actor, createdAt: { gte: since } } }))
    if (!quota.ok) return { operation: { operationId: i.operationId, state: 'missing', projectId: null, analysis: 'not_saved', code: 'NONE', dispatchAllowed: false }, claim: null, quota }
    const { w, d, venue } = boothSize(input)
    if (venue.id !== input.venueId) throw new GenerationOperationError(400, 'VENUE_CHANGED')
    const project = await tx.tenjikaiProject.create({ data: { userId: i.actor, name: input.eventName, serviceUrl: input.serviceUrl, eventName: input.eventName, eventStart: new Date(`${input.eventStart}T00:00:00+09:00`), eventDays: input.days, komaCols: input.komaCols, komaRows: input.komaRows, boothWidthM: w, boothDepthM: d, boothPosition: input.position, budgetYen: input.budgetYen, goal: input.goal, staffCount: input.staff, status: 'planning', planningVenueCode: venue.id, planningVenueName: venue.name, planningVenueNote: venue.note, planningKomaSizeM: venue.komaM, planningKomaPriceYen: venue.komaPriceYen, planningMaxHeightM: venue.maxHeightM, planningVenueSource: 'design_reference', projectedVisitors: expectedVisitors(input) }, select: projectSelect })
    const r: RevisionReceipt = { version: 2, actorHash: actorHash(i.actor), operationId: i.operationId, fingerprint, projectId: project.id, projectHash: projectHash(project), claim: null, phase: 'reserved', createdAt: now.toISOString(), claimedAt: null, settledAt: null, analysis: 'not_saved', code: 'NONE', baseRevision: '0', resultRevision: null }
    await write(tx, i.actor, i.operationId, r, null)
    return { operation: await view(tx, i.actor, i.operationId, r, now), claim: null }
  })
}
export async function claimGeneration(actor: string, operationId: string, input: ProjectInput, db: Pick<PrismaClient, '$transaction'> = prisma, now = new Date()): Promise<{ operation: GenerationOperation; claim: GenerationClaim | null }> {
  const i = identity(actor, operationId), fingerprint = generationInputFingerprint(input)
  return txRetry(db, async tx => {
    await authority(tx, i.actor)
    if (!await owner(tx, i.actor, i.operationId)) throw new GenerationOperationError(409, 'OWNER_INDEX_MISSING')
    const saved = await read(tx, i.actor, i.operationId)
    if (!saved) throw new GenerationOperationError(409, 'OPERATION_MISSING')
    const r = saved.value
    if (r.fingerprint !== fingerprint) throw new GenerationOperationError(409, 'INPUT_CHANGED')
    if (r.phase !== 'reserved') return { operation: await view(tx, i.actor, i.operationId, r, now), claim: null }
    // A v1 reservation has no base revision. It is readable as partial history,
    // but cannot be upgraded into a new provider claim without proof of its graph state.
    if (r.version === 1) throw new GenerationOperationError(409, 'LEGACY_OPERATION_REQUIRES_REVIEW')
    if (r.baseRevision === null) throw new GenerationOperationError(409, 'INVALID_RECEIPT')
    try { await lockOwnedTenjikaiRevision(tx, i.actor, r.projectId!, r.baseRevision) }
    catch (error) { if (error instanceof TenjikaiRevisionError) throw new GenerationOperationError(409, 'PROJECT_CHANGED'); throw error }
    const project = await tx.tenjikaiProject.findFirst({ where: { id: r.projectId!, userId: i.actor }, select: projectSelect })
    if (!project || projectHash(project) !== r.projectHash) throw new GenerationOperationError(409, 'PROJECT_CHANGED')
    const token = randomUUID(), next: RevisionReceipt = { ...r, phase: 'claimed', claim: token, claimedAt: now.toISOString() }
    await write(tx, i.actor, i.operationId, next, saved.raw)
    return { operation: await view(tx, i.actor, i.operationId, next, now), claim: { actor: i.actor, operationId: i.operationId, fingerprint, projectId: r.projectId!, projectHash: r.projectHash!, token, baseRevision: r.baseRevision } }
  })
}
export async function finalizeGeneration(claim: GenerationClaim, analysis: SiteAnalysis | null, db: Pick<PrismaClient, '$transaction'> = prisma, now = new Date(), provenance?: { source: 'ai' | 'mock'; notice?: string; modelId?: string }, workspace?: MaterializedWorkspace) {
  const i = identity(claim.actor, claim.operationId)
  if (!uuid.test(claim.token) || !/^[0-9a-f]{64}$/.test(claim.fingerprint) || !/^[0-9a-f]{64}$/.test(claim.projectHash)) throw new GenerationOperationError(400, 'INVALID_CLAIM')
  parseTenjikaiRevision(claim.baseRevision)
  return txRetry(db, async tx => {
    await authority(tx, i.actor)
    if (!await owner(tx, i.actor, i.operationId)) throw new GenerationOperationError(409, 'OWNER_INDEX_MISSING')
    const saved = await read(tx, i.actor, i.operationId)
    if (!saved) throw new GenerationOperationError(409, 'OPERATION_MISSING')
    const r = saved.value
    if (r.version === 1) throw new GenerationOperationError(409, 'LEGACY_OPERATION_REQUIRES_REVIEW')
    if (r.phase !== 'claimed' || r.claim !== claim.token || r.projectId !== claim.projectId || r.fingerprint !== claim.fingerprint || r.projectHash !== claim.projectHash || r.baseRevision !== claim.baseRevision) return { operation: await view(tx, i.actor, i.operationId, r, now), committed: false, workspace: null as FullTenjikaiWorkspace | null }
    try { await lockOwnedTenjikaiRevision(tx, i.actor, claim.projectId, r.baseRevision!) }
    catch (error) {
      if (!(error instanceof TenjikaiRevisionError)) throw error
      const superseded: RevisionReceipt = { ...r, phase: 'superseded', code: 'SUPERSEDED', analysis: 'not_saved', settledAt: now.toISOString() }
      await write(tx, i.actor, i.operationId, superseded, saved.raw)
      return { operation: await view(tx, i.actor, i.operationId, superseded, now), committed: false, workspace: null as FullTenjikaiWorkspace | null }
    }
    const project = await tx.tenjikaiProject.findFirst({ where: { id: claim.projectId, userId: i.actor }, select: projectSelect })
    if (!project) return { operation: await view(tx, i.actor, i.operationId, r, now), committed: false, workspace: null as FullTenjikaiWorkspace | null }
    if (projectHash(project) !== r.projectHash) throw new GenerationOperationError(409, 'PROJECT_CHANGED')
    let phase: OperationPhase = analysis ? 'completed' : 'failed'
    let code: Receipt['code'] = analysis ? 'NONE' : 'GENERATION_FAILED'
    let analysisState: Receipt['analysis'] = 'not_saved'
    let resultRevision: string | null = null
    if (analysis) {
      await tx.tenjikaiSiteAnalysis.create({ data: { projectId: claim.projectId, brand: analysis.brand, category: analysis.category, headline: analysis.headline, subline: analysis.subline, valueProps: analysis.valueProps, targets: analysis.targets, brandColors: analysis.colors, tone: analysis.tone, domain: analysis.domain, generatedSource: provenance?.source ?? null, generationNotice: provenance?.notice ?? null, generationOperationId: i.operationId, modelId: provenance?.modelId ?? null } })
      if (workspace) {
        if (workspace.analysis !== analysis && JSON.stringify(workspace.analysis) !== JSON.stringify(analysis)) throw new GenerationOperationError(409, 'WORKSPACE_ANALYSIS_CHANGED')
        await writeInitialTenjikaiWorkspace(tx, claim.projectId, workspace)
      }
      resultRevision = await advanceTenjikaiRevision(tx, i.actor, claim.projectId, BigInt(r.baseRevision!))
      analysisState = 'saved'
    }
    const next: RevisionReceipt = { ...r, phase, code, analysis: analysisState, resultRevision, settledAt: now.toISOString() }
    await write(tx, i.actor, i.operationId, next, saved.raw)
    const persistedWorkspace = workspace ? await readFullTenjikaiWorkspaceTx(tx, i.actor, claim.projectId) : null
    if (workspace && !persistedWorkspace) throw new GenerationOperationError(409, 'WORKSPACE_NOT_SAVED')
    return { operation: await view(tx, i.actor, i.operationId, next, now), committed: true, workspace: persistedWorkspace }
  })
}
/** Only a still-claimed generation may be downgraded after a failed/uncertain analysis commit. */
export async function degradeGeneration(claim: GenerationClaim, db: Pick<PrismaClient, '$transaction'> = prisma, now = new Date()) {
  const i = identity(claim.actor, claim.operationId)
  parseTenjikaiRevision(claim.baseRevision)
  return txRetry(db, async tx => {
    await authority(tx, i.actor)
    if (!await owner(tx, i.actor, i.operationId)) throw new GenerationOperationError(409, 'OWNER_INDEX_MISSING')
    const saved = await read(tx, i.actor, i.operationId)
    if (!saved) throw new GenerationOperationError(409, 'OPERATION_MISSING')
    const r = saved.value
    if (r.version === 1) throw new GenerationOperationError(409, 'LEGACY_OPERATION_REQUIRES_REVIEW')
    if (r.phase !== 'claimed' || r.claim !== claim.token || r.projectId !== claim.projectId || r.fingerprint !== claim.fingerprint || r.projectHash !== claim.projectHash || r.baseRevision !== claim.baseRevision) return { operation: await view(tx, i.actor, i.operationId, r, now), committed: false }
    try { await lockOwnedTenjikaiRevision(tx, i.actor, claim.projectId, r.baseRevision!) }
    catch (error) { if (error instanceof TenjikaiRevisionError) throw new GenerationOperationError(409, 'PROJECT_CHANGED'); throw error }
    const project = await tx.tenjikaiProject.findFirst({ where: { id: claim.projectId, userId: i.actor }, select: projectSelect })
    if (!project || projectHash(project) !== r.projectHash) throw new GenerationOperationError(409, 'PROJECT_CHANGED')
    const next: RevisionReceipt = { ...r, phase: 'degraded', code: 'ANALYSIS_UNKNOWN', analysis: 'unknown', settledAt: now.toISOString() }
    await write(tx, i.actor, i.operationId, next, saved.raw)
    return { operation: await view(tx, i.actor, i.operationId, next, now), committed: true }
  })
}
export async function statusGeneration(actor: string, operationId: string, db: Pick<PrismaClient, '$transaction'> = prisma, now = new Date()): Promise<GenerationOperation> {
  const i = identity(actor, operationId); operationTime(i.operationId, now)
  return db.$transaction(async tx => {
    const users = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "User" WHERE id = ${i.actor} FOR UPDATE`
    if (!users.some(row => row.id === i.actor)) return { operationId: i.operationId, state: 'deleted', projectId: null, analysis: 'not_saved', code: 'NONE', dispatchAllowed: false }
    await assertLifecycleWritable(tx, [i.actor])
    const hasOwner = await owner(tx, i.actor, i.operationId)
    const saved = await read(tx, i.actor, i.operationId)
    if (hasOwner !== !!saved) throw new GenerationOperationError(409, 'OWNER_INDEX_ORPHAN')
    if (!saved && now.getTime() - operationTime(i.operationId, now) >= ADMISSION_MS) return { operationId: i.operationId, state: 'unknown', projectId: null, analysis: 'unknown', code: 'NONE', dispatchAllowed: false }
    return view(tx, i.actor, i.operationId, saved?.value ?? null, now)
  }, { isolationLevel: 'ReadCommitted', maxWait: 10000, timeout: 20000 })
}
export async function cancelGeneration(actor: string, operationId: string, db: Pick<PrismaClient, '$transaction'> = prisma, now = new Date()): Promise<GenerationOperation> {
  const i = identity(actor, operationId), t = operationTime(i.operationId, now)
  return txRetry(db, async tx => {
    await authority(tx, i.actor)
    const hasOwner = await owner(tx, i.actor, i.operationId)
    const saved = await read(tx, i.actor, i.operationId)
    if (hasOwner !== !!saved) throw new GenerationOperationError(409, 'OWNER_INDEX_ORPHAN')
    if (!saved) {
      if (now.getTime() - t >= ADMISSION_MS) throw new GenerationOperationError(409, 'OPERATION_EXPIRED')
      await collectTerminalForActor(tx, i.actor, now)
      if (await tx.systemSetting.count({ where: { key: { startsWith: generationReceiptPrefix(i.actor) } } }) >= MAX_RECEIPTS) throw new GenerationOperationError(503, 'RECEIPT_CAPACITY_UNKNOWN')
      const r: RevisionReceipt = { version: 2, actorHash: actorHash(i.actor), operationId: i.operationId, fingerprint: null, projectId: null, projectHash: null, claim: null, phase: 'canceled', createdAt: now.toISOString(), claimedAt: null, settledAt: now.toISOString(), analysis: 'not_saved', code: 'CANCELED', baseRevision: null, resultRevision: null }
      await write(tx, i.actor, i.operationId, r, null)
      return view(tx, i.actor, i.operationId, r, now)
    }
    const r = saved.value
    if (r.phase !== 'reserved') return view(tx, i.actor, i.operationId, r, now)
    // A reservation has no provider claim. Keep the quota/project; cancellation never implies a refund.
    const next: Receipt = { ...r, phase: 'canceled', code: 'CANCELED', settledAt: now.toISOString() }
    await write(tx, i.actor, i.operationId, next, saved.raw)
    return view(tx, i.actor, i.operationId, next, now)
  })
}
