import { createHash } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import type { RefineDirective } from './types'
import { isPaid, type AdImageQuotaDenied } from './access'
import { claimImageBudgetInTransaction, settleImageBudgetInTransaction, releaseImageBudgetInTransaction, withAdImageBudgetTransaction, type ImageBudgetReservation } from './image-budget'

type Tx = Prisma.TransactionClient
export type AdImageOperationInput = { actor: string; operationId: string; kind: 'generate' | 'refine'; targetId: string }
type Receipt = AdImageOperationInput & { version: 1; phase: 'pending' | 'completed' | 'failed' | 'cancelled'; inputHash: string; targetHash: string; startedAt: string; reservation: ImageBudgetReservation | null; conceptId: string | null; produced: number; failedPlacements: string[]; appliedDirectives: RefineDirective[] }
export const ADIMAGE_OPERATION_LEASE_MS = 15 * 60 * 1000
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
const identifier = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(v)
export class AdImageOperationError extends Error { constructor(public status: number, public code: string, message: string) { super(message) } }
function stable(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(stable)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, stable(v)]))
  return value
}
const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(stable(v))).digest('hex')
function normalized(input: AdImageOperationInput) {
  if (!identifier(input.actor) || !identifier(input.targetId) || typeof input.operationId !== 'string' || !uuid.test(input.operationId) || !['generate', 'refine'].includes(input.kind)) throw new AdImageOperationError(400, 'INVALID_OPERATION', '操作内容を確認してください。')
  return { ...input, operationId: input.operationId.toLowerCase() }
}
const receiptKey = (r: AdImageOperationInput) => 'adimage-operation:v1:' + hash([r.actor, r.operationId.toLowerCase()])
const activeKey = (actor: string) => 'adimage-active:v1:' + hash(actor)
export function validAdImageDirectives(value: unknown): value is RefineDirective[] {
  return Array.isArray(value) && value.length <= 5 && Buffer.byteLength(JSON.stringify(value)) <= 48000 && value.every(d => d && ['copy', 'color', 'layout', 'contrast', 'visual'].includes(d.target) && typeof d.instruction === 'string' && d.instruction.length <= 20000 && typeof d.reason === 'string' && d.reason.length <= 4000)
}
function parse(value: string): Receipt {
  try {
    if (Buffer.byteLength(value) > 65536) throw new Error()
    const r: Receipt = JSON.parse(value)
    normalized(r)
    if (r.version !== 1 || !['pending', 'completed', 'failed', 'cancelled'].includes(r.phase) || !/^[a-f0-9]{64}$/.test(r.inputHash) || !/^[a-f0-9]{64}$/.test(r.targetHash) || typeof r.startedAt !== 'string' || !Number.isFinite(Date.parse(r.startedAt))
      || !Number.isSafeInteger(r.produced) || r.produced < 0 || r.produced > 10 || ((r.phase === 'completed') !== (r.produced > 0))
      || (r.conceptId !== null && !identifier(r.conceptId)) || ((r.phase === 'completed') !== Boolean(r.conceptId)) || !Array.isArray(r.failedPlacements) || r.failedPlacements.length > 10 || r.failedPlacements.some(x => typeof x !== 'string' || x.length > 160)) throw new Error()
    if (!validAdImageDirectives(r.appliedDirectives)) throw new Error()
    if (r.phase === 'pending' && !r.reservation) throw new Error()
    if (r.reservation && (r.reservation.key !== 'adimage-image:v1:' + createHash('sha256').update(r.actor).digest('hex') || !uuid.test(r.reservation.token) || !Number.isSafeInteger(r.reservation.requested) || r.reservation.requested < 1 || r.reservation.requested > 10 || r.produced > r.reservation.requested)) throw new Error()
    if (r.phase === 'completed' && (!r.reservation || r.failedPlacements.length !== r.reservation.requested - r.produced)) throw new Error()
    return r
  } catch { throw new AdImageOperationError(409, 'INVALID_RECEIPT', '操作情報を確認できません。再生成せずお問い合わせください。') }
}
async function read(tx: Tx, key: string, actor: string) {
  const row = await tx.systemSetting.findUnique({ where: { key }, select: { value: true } })
  if (!row) return null
  const r = parse(row.value)
  if (r.actor !== actor || receiptKey(r) !== key) throw new AdImageOperationError(409, 'INVALID_RECEIPT', '操作情報を確認できません。')
  return r
}
async function save(tx: Tx, r: Receipt) {
  parse(JSON.stringify(r))
  const key = receiptKey(r), value = JSON.stringify(r)
  await tx.systemSetting.upsert({ where: { key }, create: { key, value }, update: { value } })
}
async function lockActor(tx: Tx, actor: string) {
  const rows = await tx.$queryRaw<Array<{ plan: string }>>`SELECT plan FROM "User" WHERE id = ${actor} FOR UPDATE`
  return rows[0]
}
/** Compare the exact source used by the worker with the current owned source. */
export function adImageTargetHash(kind: AdImageOperationInput['kind'], target: unknown) {
  if (kind === 'generate') return hash(target)
  const r = target as { creatives?: Array<{ id: string }> }
  return hash({ ...r, creatives: [...(r.creatives || [])].sort((a, b) => a.id.localeCompare(b.id)) })
}
async function target(tx: Tx, input: AdImageOperationInput) {
  if (input.kind === 'generate') {
    await tx.$queryRaw`SELECT id FROM adimage_brand WHERE id = ${input.targetId} AND "userId" = ${input.actor} FOR UPDATE`
    return tx.adImageBrand.findFirst({ where: { id: input.targetId, userId: input.actor } })
  }
  const parent = await tx.adImageConcept.findFirst({ where: { id: input.targetId, campaign: { userId: input.actor } }, select: { campaignId: true } })
  if (!parent) return null
  await tx.$queryRaw`SELECT id FROM adimage_campaign WHERE id = ${parent.campaignId} AND "userId" = ${input.actor} FOR UPDATE`
  await tx.$queryRaw`SELECT b.id FROM adimage_brand b JOIN adimage_campaign c ON c."brandId" = b.id WHERE c.id = ${parent.campaignId} AND b."userId" = ${input.actor} FOR UPDATE OF b`
  await tx.$queryRaw`SELECT id FROM adimage_concept WHERE id = ${input.targetId} FOR UPDATE`
  return tx.adImageConcept.findFirst({ where: { id: input.targetId, campaign: { userId: input.actor, brand: { userId: input.actor } } }, include: { creatives: true, campaign: { include: { brand: true } }, feedbacks: { orderBy: { createdAt: 'desc' }, take: 1 } } })
}
async function close(tx: Tx, r: Receipt, phase: 'failed' | 'completed', conceptId: string | null = null, failedPlacements: string[] = [], produced = 0, appliedDirectives: RefineDirective[] = []) {
  if (r.phase !== 'pending') return r
  if (phase === 'failed' && r.reservation) await releaseImageBudgetInTransaction(tx, r.reservation)
  const result = { ...r, phase, conceptId, failedPlacements, produced, appliedDirectives }
  await save(tx, result)
  await tx.systemSetting.deleteMany({ where: { key: activeKey(r.actor), value: receiptKey(r) } })
  return result
}
async function expire(tx: Tx, r: Receipt | null) {
  if (r?.phase === 'pending' && Date.now() - Date.parse(r.startedAt) >= ADIMAGE_OPERATION_LEASE_MS) return close(tx, r, 'failed')
  return r
}
function bind(r: Receipt, input: AdImageOperationInput) {
  if (r.kind !== input.kind || r.targetId !== input.targetId) throw new AdImageOperationError(409, 'INPUT_CHANGED', '操作対象が変わっています。保存結果を確認してください。')
}
async function available(tx: Tx, r: Receipt) {
  if (!r.conceptId) return true
  const saved = await tx.adImageConcept.findFirst({ where: { id: r.conceptId, campaign: { userId: r.actor, brand: { userId: r.actor } } }, select: { _count: { select: { creatives: true } } } })
  return saved?._count.creatives === r.produced
}
export async function beginAdImageOperation(supplied: AdImageOperationInput, body: Record<string, unknown>, requested: number, sourceHash: string): Promise<{ state: 'started'; receipt: Receipt } | { state: 'busy' | 'unavailable' } | { state: Receipt['phase']; receipt: Receipt } | { state: 'limit'; quota: AdImageQuotaDenied }> {
  const input = normalized(supplied)
  if (!/^[a-f0-9]{64}$/.test(sourceHash) || !body || typeof body !== 'object' || Array.isArray(body) || Buffer.byteLength(JSON.stringify(body)) > 32768) throw new AdImageOperationError(400, 'INVALID_OPERATION', '入力内容を確認してください。')
  const inputHash = hash(body)
  return withAdImageBudgetTransaction(async tx => {
    const actor = await lockActor(tx, input.actor)
    if (!actor) return { state: 'unavailable' as const }
    const prior = await expire(tx, await read(tx, receiptKey(input), input.actor))
    if (prior) {
      bind(prior, input)
      if (prior.phase !== 'cancelled' && prior.inputHash !== inputHash) throw new AdImageOperationError(409, 'INPUT_CHANGED', '同じ操作の入力が変わっています。保存結果を確認してください。')
      return await available(tx, prior) ? { state: prior.phase, receipt: prior } : { state: 'unavailable' as const }
    }
    const pointer = await tx.systemSetting.findUnique({ where: { key: activeKey(input.actor) }, select: { value: true } })
    if (pointer) {
      if (!/^adimage-operation:v1:[a-f0-9]{64}$/.test(pointer.value)) throw new AdImageOperationError(409, 'INVALID_RECEIPT', '操作情報を確認できません。')
      const running = await read(tx, pointer.value, input.actor)
      if (!running) throw new AdImageOperationError(409, 'INVALID_RECEIPT', '操作情報を確認できません。')
      if ((await expire(tx, running))?.phase === 'pending') return { state: 'busy' as const }
    }
    const current = await target(tx, input)
    if (!current) {
      await save(tx, { ...input, version: 1, phase: 'cancelled', inputHash, targetHash: sourceHash, startedAt: new Date().toISOString(), reservation: null, conceptId: null, produced: 0, failedPlacements: [], appliedDirectives: [] })
      return { state: 'unavailable' as const }
    }
    if (adImageTargetHash(input.kind, current) !== sourceHash) throw new AdImageOperationError(409, 'TARGET_CHANGED', '元の情報が変わりました。画面を更新して内容を確認してください。')
    const claim = await claimImageBudgetInTransaction(tx, { userId: input.actor, guestId: null, plan: isPaid(actor.plan) ? 'PRO' : 'FREE' }, requested, input.kind === 'generate')
    const receipt: Receipt = { ...input, version: 1, phase: claim.ok ? 'pending' : 'cancelled', inputHash, targetHash: sourceHash, startedAt: new Date().toISOString(), reservation: claim.ok ? claim.reservation : null, conceptId: null, produced: 0, failedPlacements: [], appliedDirectives: [] }
    await save(tx, receipt)
    if (!claim.ok) return { state: 'limit' as const, quota: claim }
    await tx.systemSetting.upsert({ where: { key: activeKey(input.actor) }, create: { key: activeKey(input.actor), value: receiptKey(input) }, update: { value: receiptKey(input) } })
    return { state: 'started' as const, receipt }
  }, true)
}
export async function settleAdImageOperation(inputValue: AdImageOperationInput, produced: number, failedPlacements: string[], write: (tx: Tx) => Promise<{ id: string }>, appliedDirectives: RefineDirective[] = []) {
  if (!validAdImageDirectives(appliedDirectives)) throw new AdImageOperationError(400, 'INVALID_DIRECTIVES', '改善指示の内容を確認してください。')
  const input = normalized(inputValue)
  const result = await withAdImageBudgetTransaction(async tx => {
    if (!await lockActor(tx, input.actor)) return null
    const r = await expire(tx, await read(tx, receiptKey(input), input.actor))
    if (!r) throw new AdImageOperationError(409, 'OPERATION_UNAVAILABLE', '操作を確認できません。')
    bind(r, input)
    if (r.phase === 'completed') return await available(tx, r) ? r : null
    if (r.phase !== 'pending' || !r.reservation) return null
    const current = await target(tx, input)
    if (!current || adImageTargetHash(input.kind, current) !== r.targetHash) throw new AdImageOperationError(409, 'TARGET_CHANGED', '元の情報が変わりました。保存結果を確認してください。')
    if (failedPlacements.length !== r.reservation.requested - produced) throw new AdImageOperationError(502, 'INVALID_RESULT', '生成枚数と未保存分の記録が一致しません。')
    const saved = await settleImageBudgetInTransaction(tx, r.reservation, produced, write)
    if (!identifier(saved.id)) throw new AdImageOperationError(502, 'INVALID_RESULT', '保存結果を確認できません。')
    const owned = await tx.adImageConcept.findFirst({ where: { id: saved.id, campaign: { userId: input.actor, brand: { userId: input.actor }, ...(input.kind === 'generate' ? { brandId: input.targetId } : {}) }, ...(input.kind === 'refine' && 'campaignId' in current ? { parentId: input.targetId, campaignId: current.campaignId } : {}) }, select: { generation: true, _count: { select: { creatives: true } } } })
    if (!owned || owned._count.creatives !== produced || owned.generation !== (input.kind === 'refine' && 'generation' in current ? current.generation + 1 : 1)) throw new AdImageOperationError(409, 'INVALID_RESULT', '保存先の所有者と対象を確認できません。')
    return close(tx, r, 'completed', saved.id, failedPlacements, produced, appliedDirectives)
  })
  // Expiry/refund must commit before a late worker receives this rejection.
  if (!result) throw new AdImageOperationError(409, 'OPERATION_EXPIRED', '保存できる期限が切れたか、成果物が削除されています。保存結果を確認してください。')
  return result
}
export async function failAdImageOperation(value: AdImageOperationInput) {
  const input = normalized(value)
  return withAdImageBudgetTransaction(async tx => {
    if (!await lockActor(tx, input.actor)) return null
    const r = await read(tx, receiptKey(input), input.actor)
    if (!r) return null
    bind(r, input)
    return close(tx, r, 'failed') // A committed completed receipt cannot be refunded.
  })
}
export async function recoverAdImageOperation(value: AdImageOperationInput, cancelMissing = false, body?: Record<string, unknown>) {
  const input = normalized(value)
  return withAdImageBudgetTransaction(async tx => {
    if (!await lockActor(tx, input.actor)) return { state: 'unavailable' as const }
    const r = await expire(tx, await read(tx, receiptKey(input), input.actor))
    if (r) { bind(r, input); if (body && r.phase !== 'cancelled' && r.inputHash !== hash(body)) throw new AdImageOperationError(409, 'INPUT_CHANGED', '同じ操作の入力が変わっています。保存結果を確認してください。'); return await available(tx, r) ? { state: r.phase, receipt: r } : { state: 'unavailable' as const } }
    if (!cancelMissing) return { state: 'missing' as const }
    const receipt: Receipt = { ...input, version: 1, phase: 'cancelled', inputHash: hash(null), targetHash: hash(null), startedAt: new Date().toISOString(), reservation: null, conceptId: null, produced: 0, failedPlacements: [], appliedDirectives: [] }
    await save(tx, receipt)
    return { state: 'cancelled' as const, receipt }
  }, true)
}
