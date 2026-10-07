import { createHash } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { tierFrom } from '@/lib/plan-utils'
import { DOYASLIDE_LIMITS, monthStart, isSameMonth } from './limits'

type Db = Pick<typeof prisma, '$transaction'>
type Kind = 'batch' | 'regenerate' | 'chat'
type Input = { actor: string; projectId: string; operationId: string; kind: Kind; slideId?: string; message?: string; onlyPending?: boolean }
export type DoyaSlideOperationInput = Input
type Output = { imageUrl: string; rawImageUrl: string; model: string; visualPrompt?: string }
type Slot = { id: string; version: number; imageUrl: string | null; visualPrompt: string; phase: 'pending' | 'done' | 'failed'; output: (Output & { version: number }) | null }
type Receipt = { version: 1; actor: string; operationId: string; projectId: string; kind: Kind; inputHash: string; phase: 'pending' | 'completed' | 'failed' | 'cancelled'; startedAt: string; claimedAt: string | null; month: string | null; resetAt: string | null; reserved: number; limit: number; skipped: number; deferred: number; message: string | null; slots: Slot[] }
export const DOYASLIDE_OPERATION_LEASE_MS = 15 * 60 * 1000
const options = { isolationLevel: 'ReadCommitted' as const, maxWait: 10000, timeout: 30000 }
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i
const identifier = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value)
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
export class DoyaSlideOperationError extends Error { constructor(public status: number, public code: string, message: string) { super(message) } }
function validate(input: Input) {
  if (!identifier(input.actor) || !identifier(input.projectId) || typeof input.operationId !== 'string' || !uuid.test(input.operationId) || !['batch', 'regenerate', 'chat'].includes(input.kind)
    || (input.kind !== 'batch' && !identifier(input.slideId)) || (input.onlyPending !== undefined && typeof input.onlyPending !== 'boolean')) throw new DoyaSlideOperationError(400, 'INVALID_OPERATION', '操作内容を確認してください。')
}
function keys(input: Input) {
  validate(input)
  return { key: 'doyaslide-operation:v1:' + digest([input.actor, input.projectId, input.kind, input.operationId.toLowerCase()]), active: 'doyaslide-active:v1:' + digest([input.actor, input.projectId]) }
}
function fingerprint(input: Input) { return digest([input.kind, input.slideId ?? null, input.message ?? null, input.onlyPending ?? false]) }
function unadmittedReceipt(input: Input): Receipt {
  return { version: 1, actor: input.actor, operationId: input.operationId.toLowerCase(), projectId: input.projectId, kind: input.kind, inputHash: fingerprint(input), phase: 'cancelled', startedAt: new Date().toISOString(), claimedAt: null, month: null, resetAt: null, reserved: 0, limit: 0, skipped: 0, deferred: 0, message: null, slots: [] }
}
function validUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 8192) return false
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password } catch { return false }
}
function validOutput(value: unknown): value is Output {
  if (!value || typeof value !== 'object') return false
  const output = value as Output
  return validUrl(output.imageUrl) && validUrl(output.rawImageUrl) && typeof output.model === 'string' && output.model.length > 0 && output.model.length <= 128
    && (output.visualPrompt === undefined || (typeof output.visualPrompt === 'string' && output.visualPrompt.length <= 20000))
}
function parse(value: string): Receipt {
  try {
    if (Buffer.byteLength(value) > 256 * 1024) throw new Error()
    const r: Receipt = JSON.parse(value)
    if (!r || r.version !== 1 || !identifier(r.actor) || typeof r.operationId !== 'string' || !uuid.test(r.operationId) || !identifier(r.projectId) || !['batch', 'regenerate', 'chat'].includes(r.kind) || !/^[a-f0-9]{64}$/.test(r.inputHash)
      || !['pending', 'completed', 'failed', 'cancelled'].includes(r.phase) || !Number.isFinite(Date.parse(r.startedAt))
      || (r.claimedAt !== null && !Number.isFinite(Date.parse(r.claimedAt))) || (r.month !== null && !Number.isFinite(Date.parse(r.month))) || (r.resetAt !== null && !Number.isFinite(Date.parse(r.resetAt))) || ((r.month === null) !== (r.resetAt === null))
      || !Number.isSafeInteger(r.reserved) || r.reserved < 0 || r.reserved > 4 || !Number.isSafeInteger(r.limit) || r.limit < -1
      || !Number.isSafeInteger(r.skipped) || r.skipped < 0 || !Number.isSafeInteger(r.deferred) || r.deferred < 0
      || (r.message !== null && (typeof r.message !== 'string' || r.message.length > 2000)) || !Array.isArray(r.slots) || r.slots.length !== r.reserved) throw new Error()
    const seen = new Set<string>()
    for (const slot of r.slots) {
      if (!identifier(slot.id) || seen.has(slot.id) || !Number.isSafeInteger(slot.version) || slot.version < 1 || (slot.imageUrl !== null && !validUrl(slot.imageUrl))
        || typeof slot.visualPrompt !== 'string' || slot.visualPrompt.length > 20000 || !['pending', 'done', 'failed'].includes(slot.phase)
        || (slot.phase === 'done' ? !validOutput(slot.output) || !Number.isSafeInteger(slot.output?.version) || slot.output!.version !== slot.version + (slot.imageUrl ? 1 : 0) : slot.output !== null)) throw new Error()
      seen.add(slot.id)
    }
    if ((r.phase === 'cancelled' && r.reserved !== 0) || (r.phase === 'completed' && !r.slots.some(slot => slot.phase === 'done')) || (r.phase === 'failed' && r.slots.some(slot => slot.phase === 'done'))) throw new Error()
    if (r.phase === 'pending' && (!r.claimedAt || r.reserved === 0)) throw new Error()
    return r
  } catch { throw new DoyaSlideOperationError(409, 'INVALID_RECEIPT', '保存された操作を確認できません。再生成せずお問い合わせください。') }
}
async function write(tx: Prisma.TransactionClient, key: string, receipt: Receipt) {
  const value = JSON.stringify(receipt)
  if (Buffer.byteLength(value) > 256 * 1024) throw new DoyaSlideOperationError(409, 'RECEIPT_CAPACITY', '操作情報が大きすぎます。お問い合わせください。')
  await tx.systemSetting.upsert({ where: { key }, create: { key, value }, update: { value } })
}
async function lock(tx: Prisma.TransactionClient, input: Input) {
  // Every quota and operation transition follows User -> project lock order.
  const actors = await tx.$queryRaw<Array<{ id: string; plan: string }>>`SELECT id, plan FROM "User" WHERE id = ${input.actor} FOR UPDATE`
  if (!actors.some(row => row.id === input.actor)) throw new DoyaSlideOperationError(403, 'ACTOR_UNAVAILABLE', '利用者情報を確認できません。ログインし直してください。')
  const owned = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM doyaslide_projects WHERE id = ${input.projectId} AND "userId" = ${input.actor} FOR UPDATE`
  return { ...actors[0], ownsProject: owned.some(row => row.id === input.projectId) }
}
async function read(tx: Prisma.TransactionClient, key: string, input: Input) {
  const row = await tx.systemSetting.findUnique({ where: { key }, select: { value: true } })
  if (!row) return null
  const receipt = parse(row.value)
  if (receipt.actor !== input.actor || receipt.projectId !== input.projectId || key !== 'doyaslide-operation:v1:' + digest([receipt.actor, receipt.projectId, receipt.kind, receipt.operationId.toLowerCase()])) throw new DoyaSlideOperationError(409, 'INVALID_RECEIPT', '操作情報を確認できません。お問い合わせください。')
  return receipt
}
async function close(tx: Prisma.TransactionClient, input: Input, key: string, active: string, receipt: Receipt) {
  if (receipt.phase !== 'pending') return receipt
  for (const slot of receipt.slots.filter(slot => slot.phase !== 'done')) {
    const persisted = await tx.doyaSlideVersion.findUnique({ where: { id: 'doyaslide-operation-' + digest([key, slot.id]) }, select: { id: true } })
    if (persisted) throw new DoyaSlideOperationError(409, 'INVALID_RECEIPT', '保存結果と操作記録が一致しません。お問い合わせください。')
  }
  const unused = receipt.reserved - receipt.slots.filter(slot => slot.phase === 'done').length
  if (unused && receipt.month) {
    const where = { userId_serviceId: { userId: input.actor, serviceId: 'doyaslide' } }
    const subscription = await tx.userServiceSubscription.findUnique({ where, select: { monthlyUsage: true, lastUsageReset: true } })
    if (subscription && isSameMonth(subscription.lastUsageReset, new Date(receipt.month)) && subscription.lastUsageReset.getTime() === Date.parse(receipt.resetAt!)) {
      if (!Number.isSafeInteger(subscription.monthlyUsage) || subscription.monthlyUsage < unused) throw new DoyaSlideOperationError(409, 'QUOTA_INCONSISTENT', '利用枠の記録を確認できません。お問い合わせください。')
      await tx.userServiceSubscription.update({ where, data: { monthlyUsage: { decrement: unused } } })
    }
  }
  // Only a still-owned unchanged claim may change the project's working state.
  const owned = await tx.doyaSlideProject.findFirst({ where: { id: input.projectId, userId: input.actor, status: 'generating', updatedAt: new Date(receipt.claimedAt!) }, select: { id: true } })
  if (owned) {
    for (const slot of receipt.slots.filter(slot => slot.phase !== 'done')) {
      await tx.doyaSlideSlide.updateMany({ where: { id: slot.id, projectId: input.projectId, version: slot.version, imageUrl: slot.imageUrl, visualPrompt: slot.visualPrompt, status: 'generating' }, data: { status: slot.imageUrl ? 'done' : 'error' } })
    }
    const anyDone = await tx.doyaSlideSlide.count({ where: { projectId: input.projectId, imageUrl: { not: null } } })
    await tx.doyaSlideProject.update({ where: { id: input.projectId }, data: { status: anyDone ? 'completed' : 'error' } })
  }
  const finished: Receipt = { ...receipt, phase: receipt.slots.some(slot => slot.phase === 'done') ? 'completed' : 'failed', slots: receipt.slots.map(slot => slot.phase === 'pending' ? { ...slot, phase: 'failed' } : slot) }
  await write(tx, key, finished)
  await tx.systemSetting.deleteMany({ where: { key: active, value: key } })
  return finished
}
async function expire(tx: Prisma.TransactionClient, input: Input, key: string, active: string, receipt: Receipt | null) {
  if (receipt?.phase === 'pending' && Date.now() - Date.parse(receipt.startedAt) >= DOYASLIDE_OPERATION_LEASE_MS) return close(tx, input, key, active, receipt)
  return receipt
}
async function resultsAvailable(tx: Prisma.TransactionClient, input: Input, key: string, receipt: Receipt) {
  for (const slot of receipt.slots.filter(item => item.phase === 'done')) {
    const version = await tx.doyaSlideVersion.findFirst({ where: { id: 'doyaslide-operation-' + digest([key, slot.id]), slide: { projectId: input.projectId, project: { userId: input.actor } } }, select: { id: true } })
    if (!version) return false
  }
  return true
}
export async function beginDoyaSlideOperation(input: Input, db: Db = prisma) {
  const { key, active } = keys(input)
  if (input.kind === 'chat' && (typeof input.message !== 'string' || !input.message.trim() || input.message.length > 2000)) throw new DoyaSlideOperationError(400, 'INVALID_OPERATION', '修正内容を確認してください。')
  return db.$transaction(async tx => {
    const actor = await lock(tx, input)
    const prior = await expire(tx, input, key, active, await read(tx, key, input))
    if (!actor.ownsProject) return { state: 'unavailable' as const }
    if (prior) {
      if (prior.phase !== 'cancelled' && prior.inputHash !== fingerprint(input)) throw new DoyaSlideOperationError(409, 'INPUT_CHANGED', '同じ操作の入力が変わっています。保存結果を確認してください。')
      if (!(await resultsAvailable(tx, input, key, prior))) return { state: 'unavailable' as const }
      return { state: prior.phase, receipt: prior }
    }
    const pointer = await tx.systemSetting.findUnique({ where: { key: active }, select: { value: true } })
    if (pointer) {
      if (!/^doyaslide-operation:v1:[a-f0-9]{64}$/.test(pointer.value)) throw new DoyaSlideOperationError(409, 'INVALID_RECEIPT', '操作情報を確認できません。お問い合わせください。')
      const running = await read(tx, pointer.value, input)
      if (!running || running.projectId !== input.projectId) throw new DoyaSlideOperationError(409, 'INVALID_RECEIPT', '操作情報を確認できません。お問い合わせください。')
      const resolved = await expire(tx, input, pointer.value, active, running)
      if (resolved?.phase === 'pending') return { state: 'busy' as const }
    }
    const project = await tx.doyaSlideProject.findFirst({ where: { id: input.projectId, userId: input.actor }, include: { slides: { orderBy: { index: 'asc' } } } })
    if (!project) throw new DoyaSlideOperationError(404, 'PROJECT_UNAVAILABLE', '資料を確認できません。')
    if (['generating', 'structuring'].includes(project.status) || project.slides.some(slide => slide.status === 'generating')) throw new DoyaSlideOperationError(409, 'LEGACY_UNCONFIRMED', '以前の処理結果を確認できません。再生成せず、資料IDを添えてお問い合わせください。')
    const targets = input.kind === 'batch' ? project.slides.filter(slide => !input.onlyPending || !slide.imageUrl) : project.slides.filter(slide => slide.id === input.slideId)
    if (!targets.length) {
      // Fence this UUID even when no work was needed. A delayed duplicate must
      // not start later if a slide is subsequently added or its image removed.
      await write(tx, key, unadmittedReceipt(input))
      return { state: 'empty' as const }
    }
    const limit = process.env.DOYA_DISABLE_LIMITS === '1' ? -1 : DOYASLIDE_LIMITS[tierFrom(actor.plan)].maxSlidesPerMonth
    const now = new Date(), where = { userId_serviceId: { userId: input.actor, serviceId: 'doyaslide' } }
    const subscription = await tx.userServiceSubscription.findUnique({ where, select: { monthlyUsage: true, lastUsageReset: true } })
    if (subscription && (!Number.isSafeInteger(subscription.monthlyUsage) || subscription.monthlyUsage < 0)) throw new DoyaSlideOperationError(409, 'QUOTA_INCONSISTENT', '利用枠を確認できません。お問い合わせください。')
    const used = subscription && isSameMonth(subscription.lastUsageReset, now) ? subscription.monthlyUsage : 0
    // One bounded wave per request. Never reserve unfinished future waves.
    const requested = Math.min(4, targets.length), granted = limit < 0 ? requested : Math.min(requested, Math.max(0, limit - used))
    if (!granted) {
      // A later reset/upgrade is not permission to run an old rejected request.
      await write(tx, key, unadmittedReceipt(input))
      return { state: 'limit' as const, limit }
    }
    const resetAt = subscription && isSameMonth(subscription.lastUsageReset, now) ? subscription.lastUsageReset : now
    if (limit >= 0) await tx.userServiceSubscription.upsert({ where, create: { userId: input.actor, serviceId: 'doyaslide', monthlyUsage: granted, lastUsageReset: now }, update: { monthlyUsage: used + granted, lastUsageReset: resetAt } })
    const selected = targets.slice(0, granted)
    const receipt: Receipt = { version: 1, actor: input.actor, operationId: input.operationId.toLowerCase(), projectId: input.projectId, kind: input.kind, inputHash: fingerprint(input), phase: 'pending', startedAt: now.toISOString(), claimedAt: now.toISOString(), month: limit < 0 ? null : monthStart(now).toISOString(), resetAt: limit < 0 ? null : resetAt.toISOString(), reserved: granted, limit, skipped: granted < requested ? targets.length - granted : 0, deferred: granted < requested ? 0 : targets.length - requested, message: input.kind === 'chat' ? input.message! : null, slots: selected.map(slide => ({ id: slide.id, version: slide.version, imageUrl: slide.imageUrl, visualPrompt: slide.visualPrompt, phase: 'pending', output: null })) }
    // Validate DB snapshots before quota/receipt transaction can commit.
    parse(JSON.stringify(receipt))
    await tx.doyaSlideProject.update({ where: { id: project.id }, data: { status: 'generating', updatedAt: now } })
    await tx.doyaSlideSlide.updateMany({ where: { id: { in: selected.map(slide => slide.id) }, projectId: project.id }, data: { status: 'generating' } })
    await write(tx, key, receipt)
    await tx.systemSetting.upsert({ where: { key: active }, create: { key: active, value: key }, update: { value: key } })
    return { state: 'started' as const, receipt, project, slides: selected }
  }, options)
}
export async function settleDoyaSlideOperationSlot(input: Input, slideId: string, output: Output, db: Db = prisma) {
  const { key, active } = keys(input)
  if (!identifier(slideId) || !validOutput(output)) throw new DoyaSlideOperationError(502, 'INVALID_RESULT', '生成結果を確認できませんでした。')
  const outcome = await db.$transaction(async tx => {
    const actor = await lock(tx, input)
    const receipt = await expire(tx, input, key, active, await read(tx, key, input))
    if (!actor.ownsProject) return { expired: true as const }
    if (!receipt || receipt.inputHash !== fingerprint(input)) throw new DoyaSlideOperationError(409, 'OPERATION_UNAVAILABLE', '保存対象の操作を確認できません。')
    const slot = receipt.slots.find(item => item.id === slideId)
    if (slot?.phase === 'done') {
      if (!(await resultsAvailable(tx, input, key, receipt))) return { unavailable: true as const }
      return { output: slot.output! }
    }
    if (receipt.phase !== 'pending' || !slot || slot.phase !== 'pending') return { expired: true as const }
    const project = await tx.doyaSlideProject.findFirst({ where: { id: input.projectId, userId: input.actor, status: 'generating', updatedAt: new Date(receipt.claimedAt!) }, select: { id: true } })
    if (!project) throw new DoyaSlideOperationError(409, 'PROJECT_CHANGED', '資料の状態が変わりました。保存結果を確認してください。')
    const nextVersion = slot.imageUrl ? slot.version + 1 : slot.version
    const prompt = output.visualPrompt ?? slot.visualPrompt
    const updated = await tx.doyaSlideSlide.updateMany({ where: { id: slot.id, projectId: input.projectId, version: slot.version, imageUrl: slot.imageUrl, visualPrompt: slot.visualPrompt, status: 'generating' }, data: { imageUrl: output.imageUrl, rawImageUrl: output.rawImageUrl, model: output.model, visualPrompt: prompt, version: nextVersion, status: 'done' } })
    if (updated.count !== 1) throw new DoyaSlideOperationError(409, 'SLIDE_CHANGED', 'スライドの状態が変わりました。保存結果を確認してください。')
    await tx.doyaSlideVersion.create({ data: { id: 'doyaslide-operation-' + digest([key, slideId]), slideId, version: nextVersion, imageUrl: output.imageUrl, rawImageUrl: output.rawImageUrl, prompt } })
    if (receipt.kind === 'chat') {
      await tx.doyaSlideChatMessage.create({ data: { slideId, role: 'user', content: receipt.message! } })
      await tx.doyaSlideChatMessage.create({ data: { slideId, role: 'assistant', content: '修正を反映しました。' } })
    }
    slot.phase = 'done'; slot.output = { ...output, visualPrompt: prompt, version: nextVersion }
    await write(tx, key, receipt)
    if (receipt.slots.every(item => item.phase === 'done')) await close(tx, input, key, active, receipt)
    return { output: slot.output }
  }, options)
  // Terminal expiry/refund must commit even when a late worker is rejected.
  if ('unavailable' in outcome) throw new DoyaSlideOperationError(410, 'RESULT_UNAVAILABLE', '保存結果は削除されています。この操作は再実行されません。')
  if ('expired' in outcome) throw new DoyaSlideOperationError(409, 'OPERATION_EXPIRED', '処理の有効期限が切れました。保存結果を確認してください。')
  return outcome.output
}
export async function finishDoyaSlideOperation(input: Input, db: Db = prisma) {
  const { key, active } = keys(input)
  const result = await db.$transaction(async tx => {
    const actor = await lock(tx, input)
    const receipt = await read(tx, key, input)
    if (!receipt || receipt.inputHash !== fingerprint(input)) throw new DoyaSlideOperationError(409, 'OPERATION_UNAVAILABLE', '操作を確認できません。')
    const finished = await close(tx, input, key, active, receipt)
    return actor.ownsProject && await resultsAvailable(tx, input, key, finished) ? finished : null
  }, options)
  if (!result) throw new DoyaSlideOperationError(404, 'PROJECT_UNAVAILABLE', '資料を確認できません。')
  return result
}
export async function recoverDoyaSlideOperation(input: Input, cancelMissing = false, db: Db = prisma) {
  const { key, active } = keys(input)
  return db.$transaction(async tx => {
    const actor = await lock(tx, input)
    const receipt = await expire(tx, input, key, active, await read(tx, key, input))
    if (!actor.ownsProject) return { state: 'unavailable' as const }
    if (receipt) {
      if (input.kind !== 'batch' && receipt.slots.length && receipt.slots[0].id !== input.slideId) throw new DoyaSlideOperationError(409, 'INPUT_CHANGED', '操作対象のスライドが一致しません。')
      if (!(await resultsAvailable(tx, input, key, receipt))) return { state: 'unavailable' as const }
      return { state: receipt.phase, receipt }
    }
    if (!cancelMissing) return { state: 'missing' as const }
    const cancelled = unadmittedReceipt(input)
    await write(tx, key, cancelled)
    return { state: 'cancelled' as const, receipt: cancelled }
  }, options)
}
