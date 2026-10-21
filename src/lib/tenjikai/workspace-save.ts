import { createHash } from 'node:crypto'
import { Prisma, type PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { advanceTenjikaiRevision, lockOwnedTenjikaiRevision, lockTenjikaiActor, parseTenjikaiRevision } from './project-revision'
import { readFullTenjikaiWorkspaceTx } from './workspace-store'
import type { FullTenjikaiWorkspace } from './workspace-dto'

const PREFIX = 'tenjikai-workspace-save:v1:'
const OWNER = 'tenjikai-workspace-save-owner:v1:'
const OP = /^save\.(\d{13})\.([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i
const ID = /^[A-Za-z0-9_-]{1,128}$/
const DAY = 86_400_000
const LIMIT = 512
const options = { isolationLevel: 'Serializable' as const, maxWait: 10000, timeout: 20000 }
const sha = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex')
const actorHash = (actor: string) => sha(actor)
const receiptKey = (actor: string, op: string) => PREFIX + actorHash(actor) + ':' + op
const ownerKey = (op: string) => OWNER + op
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const integer = (v: unknown, max: number): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= max

export type WorkspacePatch = { variant?: 'A' | 'B' | 'C'; selectedNoveltyIds?: string[]; budgetYen?: number; doneDeadlineIds?: string[] }
type Receipt = { version: 1; actorHash: string; operationId: string; projectId: string | null; digest: string | null;
  expectedRevision: string | null; resultRevision: string | null; phase: 'committed' | 'canceled'; createdAt: string }
export type WorkspaceSaveStatus = { operationId: string; state: 'missing' | 'committed' | 'superseded' | 'canceled';
  projectId: string | null; resultRevision: string | null; workspace: FullTenjikaiWorkspace | null }
export class WorkspaceSaveError extends Error {
  constructor(readonly status: 400 | 404 | 409 | 503, readonly code: string) { super('保存操作の状態を確認できません。') }
}
export function validWorkspaceSaveOperationId(v: unknown): v is string { return typeof v === 'string' && OP.test(v) }
function identity(actor: string, operationId: string) {
  if (!ID.test(actor) || !validWorkspaceSaveOperationId(operationId)) throw new WorkspaceSaveError(400, 'INVALID_OPERATION')
  return { actor, operationId: operationId.toLowerCase() }
}
function issuedAt(operationId: string, now: Date) {
  const t = Number(OP.exec(operationId)![1])
  if (!Number.isSafeInteger(t) || t > now.getTime() + 300_000) throw new WorkspaceSaveError(400, 'INVALID_OPERATION_TIME')
  return t
}
export function readWorkspacePatch(raw: unknown): WorkspacePatch | null {
  if (!record(raw) || !Object.keys(raw).length || Object.keys(raw).some(k => !['variant', 'selectedNoveltyIds', 'budgetYen', 'doneDeadlineIds'].includes(k))) return null
  if (raw.variant !== undefined && !['A', 'B', 'C'].includes(String(raw.variant))) return null
  if (raw.budgetYen !== undefined && !integer(raw.budgetYen, 1_000_000_000)) return null
  for (const name of ['selectedNoveltyIds', 'doneDeadlineIds'] as const) {
    const list = raw[name]
    if (list !== undefined && (!Array.isArray(list) || list.length > (name === 'selectedNoveltyIds' ? 6 : 10) ||
        !list.every(v => typeof v === 'string' && ID.test(v)) || new Set(list).size !== list.length)) return null
  }
  return raw as WorkspacePatch
}
function patchDigest(projectId: string, revision: string, p: WorkspacePatch) {
  return sha([projectId, revision, p.variant ?? null, p.selectedNoveltyIds === undefined ? null : [...p.selectedNoveltyIds].sort(),
    p.budgetYen ?? null, p.doneDeadlineIds === undefined ? null : [...p.doneDeadlineIds].sort()])
}
function parse(raw: string, actor: string, operationId: string): Receipt {
  try {
    if (Buffer.byteLength(raw) > 1024) throw Error()
    const value: unknown = JSON.parse(raw)
    if (!record(value) || Object.keys(value).sort().join(',') !== 'actorHash,createdAt,digest,expectedRevision,operationId,phase,projectId,resultRevision,version' ||
      value.version !== 1 || value.actorHash !== actorHash(actor) || value.operationId !== operationId ||
      !['committed', 'canceled'].includes(String(value.phase)) || typeof value.createdAt !== 'string' ||
      !Number.isFinite(Date.parse(value.createdAt)) || new Date(value.createdAt).toISOString() !== value.createdAt ||
      !(value.projectId === null || typeof value.projectId === 'string' && ID.test(value.projectId)) ||
      !(value.digest === null || typeof value.digest === 'string' && /^[a-f0-9]{64}$/.test(value.digest))) throw Error()
    const r = value as Receipt
    if (r.phase === 'committed') {
      if (!r.projectId || !r.digest || !r.expectedRevision || !r.resultRevision ||
        parseTenjikaiRevision(r.resultRevision) !== parseTenjikaiRevision(r.expectedRevision) + 1n) throw Error()
    } else if (r.projectId || r.digest || r.expectedRevision || r.resultRevision) throw Error()
    return r
  } catch { throw new WorkspaceSaveError(409, 'INVALID_RECEIPT') }
}
async function indexed(tx: Prisma.TransactionClient, actor: string, op: string) {
  await tx.$queryRaw`SELECT 1::integer FROM pg_advisory_xact_lock(hashtext(${op})::bigint)`
  const owner = await tx.systemSetting.findUnique({ where: { key: ownerKey(op) }, select: { value: true } })
  if (owner && owner.value !== actorHash(actor)) throw new WorkspaceSaveError(409, 'FOREIGN_OPERATION')
  const receipt = await tx.systemSetting.findUnique({ where: { key: receiptKey(actor, op) }, select: { value: true } })
  if (!!owner !== !!receipt) throw new WorkspaceSaveError(409, 'OWNER_INDEX_ORPHAN')
  return receipt ? parse(receipt.value, actor, op) : null
}
async function retry<T>(db: Pick<PrismaClient, '$transaction'>, work: (tx: Prisma.TransactionClient) => Promise<T>) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try { return await db.$transaction(work, options) }
    catch (error) {
      const e = error as { code?: string; meta?: { code?: string } }
      if (!(e.code === 'P2034' || e.code === 'P2010' && ['40001', '40P01'].includes(e.meta?.code ?? '')) || attempt === 4) throw error
    }
  }
  throw new WorkspaceSaveError(503, 'TRANSACTION_UNAVAILABLE')
}
async function view(tx: Prisma.TransactionClient, actor: string, op: string, r: Receipt | null): Promise<WorkspaceSaveStatus> {
  if (!r) return { operationId: op, state: 'missing', projectId: null, resultRevision: null, workspace: null }
  if (r.phase === 'canceled') return { operationId: op, state: 'canceled', projectId: null, resultRevision: null, workspace: null }
  const rows = await tx.$queryRaw<Array<{ revision: bigint }>>`SELECT revision FROM tenjikai_project WHERE id = ${r.projectId} AND "userId" = ${actor} FOR SHARE`
  if (rows.length !== 1 || rows[0].revision.toString() !== r.resultRevision) return {
    operationId: op, state: 'superseded', projectId: rows.length ? r.projectId : null, resultRevision: r.resultRevision, workspace: null,
  }
  const workspace = await readFullTenjikaiWorkspaceTx(tx, actor, r.projectId!)
  if (!workspace) throw new WorkspaceSaveError(409, 'WORKSPACE_MISSING')
  return { operationId: op, state: 'committed', projectId: r.projectId, resultRevision: r.resultRevision, workspace }
}
async function capacity(tx: Prisma.TransactionClient, actor: string, now: Date) {
  const prefix = PREFIX + actorHash(actor) + ':'
  const rows = await tx.systemSetting.findMany({ where: { key: { startsWith: prefix } }, select: { key: true, value: true }, take: LIMIT + 1 })
  if (rows.length > LIMIT) throw new WorkspaceSaveError(503, 'RECEIPT_CAPACITY_UNKNOWN')
  for (const row of rows) {
    const op = row.key.slice(prefix.length)
    if (!validWorkspaceSaveOperationId(op)) throw new WorkspaceSaveError(409, 'INVALID_RECEIPT')
    parse(row.value, actor, op)
    if (now.getTime() - issuedAt(op, now) < 30 * DAY) continue
    await tx.$queryRaw`SELECT 1::integer FROM pg_advisory_xact_lock(hashtext(${op})::bigint)`
    if ((await tx.systemSetting.deleteMany({ where: { key: row.key, value: row.value } })).count !== 1 ||
      (await tx.systemSetting.deleteMany({ where: { key: ownerKey(op), value: actorHash(actor) } })).count !== 1) throw new WorkspaceSaveError(409, 'RECEIPT_CHANGED')
  }
  if (await tx.systemSetting.count({ where: { key: { startsWith: prefix } } }) >= LIMIT) throw new WorkspaceSaveError(503, 'RECEIPT_CAPACITY_UNKNOWN')
}
async function insert(tx: Prisma.TransactionClient, actor: string, r: Receipt) {
  await tx.systemSetting.create({ data: { key: ownerKey(r.operationId), value: actorHash(actor) } })
  await tx.systemSetting.create({ data: { key: receiptKey(actor, r.operationId), value: JSON.stringify(r) } })
}
export async function statusWorkspaceSave(actor: string, operationId: string, db: Pick<PrismaClient, '$transaction'> = prisma) {
  const i = identity(actor, operationId)
  return retry(db, async tx => { await lockTenjikaiActor(tx, i.actor); return view(tx, i.actor, i.operationId, await indexed(tx, i.actor, i.operationId)) })
}
/** A missing cancellation is a tombstone; a delayed POST with this ID cannot mutate. */
export async function cancelMissingWorkspaceSave(actor: string, operationId: string, db: Pick<PrismaClient, '$transaction'> = prisma, now = new Date()) {
  const i = identity(actor, operationId), time = issuedAt(i.operationId, now)
  return retry(db, async tx => {
    await lockTenjikaiActor(tx, i.actor)
    const previous = await indexed(tx, i.actor, i.operationId)
    if (previous) return view(tx, i.actor, i.operationId, previous)
    if (now.getTime() - time >= DAY) throw new WorkspaceSaveError(409, 'OPERATION_EXPIRED')
    await capacity(tx, i.actor, now)
    const r: Receipt = { version: 1, actorHash: actorHash(i.actor), operationId: i.operationId, projectId: null,
      digest: null, expectedRevision: null, resultRevision: null, phase: 'canceled', createdAt: now.toISOString() }
    await insert(tx, i.actor, r)
    return view(tx, i.actor, i.operationId, r)
  })
}

/** User -> operation advisory/index -> owned project -> child rows -> revision and receipt. */
export async function saveTenjikaiWorkspace(actor: string, projectId: string, operationId: string,
  expectedRevision: string, rawPatch: unknown, db: Pick<PrismaClient, '$transaction'> = prisma, now = new Date()) {
  const i = identity(actor, operationId), time = issuedAt(i.operationId, now)
  if (!ID.test(projectId)) throw new WorkspaceSaveError(400, 'INVALID_PROJECT')
  parseTenjikaiRevision(expectedRevision)
  const patch = readWorkspacePatch(rawPatch)
  if (!patch) throw new WorkspaceSaveError(400, 'INVALID_PATCH')
  const digest = patchDigest(projectId, expectedRevision, patch)
  return retry(db, async tx => {
    await lockTenjikaiActor(tx, i.actor)
    const prior = await indexed(tx, i.actor, i.operationId)
    if (prior) {
      if (prior.phase === 'canceled' || prior.projectId !== projectId || prior.expectedRevision !== expectedRevision || prior.digest !== digest)
        throw new WorkspaceSaveError(409, 'OPERATION_CHANGED')
      return view(tx, i.actor, i.operationId, prior)
    }
    if (now.getTime() - time >= DAY) throw new WorkspaceSaveError(409, 'OPERATION_EXPIRED')
    await capacity(tx, i.actor, now)
    const revision = await lockOwnedTenjikaiRevision(tx, i.actor, projectId, expectedRevision)
    const workspace = await readFullTenjikaiWorkspaceTx(tx, i.actor, projectId)
    if (!workspace) throw new WorkspaceSaveError(409, 'WORKSPACE_NOT_FULL')
    if (patch.variant !== undefined) {
      const target = workspace.plans.find(row => row.plan.variant === patch.variant)
      const build = workspace.budgetLines.find(row => row.sourceLineKey === 'build')
      const electric = workspace.budgetLines.find(row => row.sourceLineKey === 'electric')
      if (!target || !build || !electric || build.source !== 'ai' || build.status !== 'planned' ||
          electric.source !== 'ai' || electric.status !== 'planned') throw new WorkspaceSaveError(409, 'PLAN_BUDGET_UNAVAILABLE')
      if ((await tx.tenjikaiBoothPlan.updateMany({ where: { projectId, selected: true }, data: { selected: false } })).count !== 1 ||
          (await tx.tenjikaiBoothPlan.updateMany({ where: { id: target.dbId, projectId }, data: { selected: true } })).count !== 1)
        throw new WorkspaceSaveError(409, 'PLAN_CHANGED')
      if ((await tx.tenjikaiBudgetLine.updateMany({ where: { id: build.dbId, projectId, source: 'ai', status: 'planned' }, data: {
        amountYen: target.cost.total,
        label: `部材 ¥${target.cost.parts.toLocaleString()} / 床 ¥${target.cost.carpet.toLocaleString()} / デザイン・施工費`,
      } })).count !== 1 ||
          (await tx.tenjikaiBudgetLine.updateMany({ where: { id: electric.dbId, projectId, source: 'ai', status: 'planned' }, data: {
            amountYen: target.electric.amountYen, label: target.electric.detail,
          } })).count !== 1) throw new WorkspaceSaveError(409, 'BUDGET_CHANGED')
    }
    if (patch.selectedNoveltyIds !== undefined) {
      if (patch.selectedNoveltyIds.some(id => !workspace.novelties.some(row => row.id === id)))
        throw new WorkspaceSaveError(409, 'NOVELTY_CHANGED')
      for (const row of workspace.novelties) {
        if ((await tx.tenjikaiNovelty.updateMany({ where: { id: row.dbId, projectId }, data: {
          selected: patch.selectedNoveltyIds.includes(row.id),
        } })).count !== 1) throw new WorkspaceSaveError(409, 'NOVELTY_CHANGED')
      }
      const line = workspace.budgetLines.find(row => row.sourceLineKey === 'novelty')
      const amount = workspace.novelties.filter(row => patch.selectedNoveltyIds!.includes(row.id))
        .reduce((sum, row) => sum + row.unitYen * row.quantity, 0)
      if (!line || line.source !== 'ai' || line.status !== 'planned' || !integer(amount, 2_147_483_647) ||
          (await tx.tenjikaiBudgetLine.updateMany({ where: { id: line.dbId, projectId, source: 'ai', status: 'planned' }, data: {
            amountYen: amount, label: patch.selectedNoveltyIds.length + '品目',
          } })).count !== 1) throw new WorkspaceSaveError(409, 'BUDGET_CHANGED')
    }
    if (patch.budgetYen !== undefined &&
        (await tx.tenjikaiProject.updateMany({ where: { id: projectId, userId: i.actor }, data: { budgetYen: patch.budgetYen } })).count !== 1)
      throw new WorkspaceSaveError(409, 'PROJECT_CHANGED')
    if (patch.doneDeadlineIds !== undefined) {
      if (patch.doneDeadlineIds.some(id => !workspace.deadlines.some(row => row.id === id)))
        throw new WorkspaceSaveError(409, 'DEADLINE_CHANGED')
      for (const row of workspace.deadlines) {
        if ((await tx.tenjikaiTask.updateMany({ where: { id: row.dbId, projectId }, data: {
          done: patch.doneDeadlineIds.includes(row.id),
        } })).count !== 1) throw new WorkspaceSaveError(409, 'DEADLINE_CHANGED')
      }
    }
    const resultRevision = await advanceTenjikaiRevision(tx, i.actor, projectId, revision)
    const receipt: Receipt = { version: 1, actorHash: actorHash(i.actor), operationId: i.operationId, projectId,
      digest, expectedRevision, resultRevision, phase: 'committed', createdAt: now.toISOString() }
    await insert(tx, i.actor, receipt)
    return view(tx, i.actor, i.operationId, receipt)
  })
}

/** Caller already holds the User lock; an account purge removes receipts and owner indexes together. */
export async function purgeWorkspaceSaveReceipts(tx: Prisma.TransactionClient, actor: string) {
  if (!ID.test(actor)) throw new WorkspaceSaveError(400, 'INVALID_ACTOR')
  const prefix = PREFIX + actorHash(actor) + ':'
  const rows = await tx.systemSetting.findMany({ where: { key: { startsWith: prefix } }, select: { key: true, value: true }, take: LIMIT + 1 })
  if (rows.length > LIMIT) throw new WorkspaceSaveError(409, 'RECEIPT_CAPACITY_UNKNOWN')
  for (const row of rows) {
    const op = row.key.slice(prefix.length)
    if (!validWorkspaceSaveOperationId(op)) throw new WorkspaceSaveError(409, 'INVALID_RECEIPT')
    parse(row.value, actor, op)
    await tx.$queryRaw`SELECT 1::integer FROM pg_advisory_xact_lock(hashtext(${op})::bigint)`
    if ((await tx.systemSetting.deleteMany({ where: { key: row.key, value: row.value } })).count !== 1 ||
        (await tx.systemSetting.deleteMany({ where: { key: ownerKey(op), value: actorHash(actor) } })).count !== 1)
      throw new WorkspaceSaveError(409, 'RECEIPT_CHANGED')
  }
  await tx.systemSetting.deleteMany({ where: { key: { startsWith: OWNER }, value: actorHash(actor) } })
}
