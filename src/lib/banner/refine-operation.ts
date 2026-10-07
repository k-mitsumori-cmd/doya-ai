import { createHash } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { reserveBannerMonthlyImages, releaseBannerMonthlyImages, type BannerReservation } from './monthly-quota'

type Db = Pick<typeof prisma, '$transaction'>
type Input = { originalImage: string; instruction: string; category?: string; size?: string }
type Receipt = { version: 1; inputHash: string; state: 'pending' | 'completed' | 'failed' | 'cancelled'; startedAt: string; reservation: (Omit<BannerReservation, 'lastUsageReset'> & { lastUsageReset: string }) | null; generationId: string | null }
export class BannerOperationError extends Error { constructor(public status: number, message: string) { super(message) } }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
export function bannerRefineOperationId(value: unknown): string {
  if (typeof value !== 'string' || !UUID.test(value)) throw new BannerOperationError(400, '操作情報を確認できません。画面を開き直してください。')
  return value.toLowerCase()
}
export function bannerRefineFingerprint(input: Input) { return hash([input.originalImage, input.instruction, input.category ?? '', input.size ?? '']) }
function keyFor(userId: string, operationId: string) {
  if (!userId) throw new BannerOperationError(401, 'ログインが必要です。')
  return 'banner-refine:v1:' + hash([userId, bannerRefineOperationId(operationId)])
}
function parse(value: string): Receipt {
  let saved: Receipt
  try { saved = JSON.parse(value) } catch { throw new BannerOperationError(409, '操作の保存記録を確認できません。再生成せずお問い合わせください。') }
  const valid = saved && saved.version === 1 && typeof saved.inputHash === 'string' && /^[a-f0-9]{64}$/.test(saved.inputHash) && ['pending', 'completed', 'failed', 'cancelled'].includes(saved.state) && typeof saved.startedAt === 'string' && Number.isFinite(Date.parse(saved.startedAt)) && (saved.generationId === null || (typeof saved.generationId === 'string' && saved.generationId.length > 0 && saved.generationId.length <= 128))
  if (!valid || (saved.state === 'completed' ? !saved.generationId : saved.generationId !== null)) throw new BannerOperationError(409, '操作の保存記録を確認できません。再生成せずお問い合わせください。')
  if (saved.reservation !== null) {
    const r = saved.reservation
    if (!r || typeof r.id !== 'string' || r.count !== 1 || r.requested !== 1 || typeof r.lastUsageReset !== 'string' || !Number.isFinite(Date.parse(r.lastUsageReset)) || typeof r.plan !== 'string' || !r.usage || !Number.isSafeInteger(r.usage.monthlyUsed) || r.usage.monthlyUsed < 0 || !Number.isSafeInteger(r.usage.monthlyLimit) || r.usage.monthlyLimit < -1 || !Number.isSafeInteger(r.usage.monthlyRemaining) || r.usage.monthlyRemaining < -1) throw new BannerOperationError(409, '操作の利用枠記録を確認できません。再生成せずお問い合わせください。')
  }
  return saved
}
async function lock(tx: Prisma.TransactionClient, userId: string, key: string) {
  const actors = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "User" WHERE id = ${userId} FOR SHARE`
  if (!actors.some(row => row.id === userId)) throw new BannerOperationError(403, '利用者情報を確認できません。ログインし直してください。')
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('banner-refine:v1'), hashtext(${key}))`
  const row = await tx.systemSetting.findUnique({ where: { key }, select: { value: true } })
  return row ? parse(row.value) : null
}
async function result(tx: Prisma.TransactionClient, userId: string, saved: Receipt, cutoff: Date | null) {
  if (saved.state !== 'completed' || !saved.generationId || !cutoff) return null
  return tx.generation.findFirst({ where: { id: saved.generationId, userId, serviceId: 'banner', outputType: 'IMAGE', createdAt: { gte: cutoff } }, select: { id: true, output: true, createdAt: true } })
}
export async function beginBannerRefinement(userId: string, operationId: string, inputHash: string, cutoff: Date | null, disableLimits = false, db: Db = prisma) {
  const key = keyFor(userId, operationId)
  if (!/^[a-f0-9]{64}$/.test(inputHash)) throw new BannerOperationError(400, '修正内容を確認できません。')
  return db.$transaction(async tx => {
    const saved = await lock(tx, userId, key)
    if (saved) {
      if (saved.state === 'cancelled') return { state: 'cancelled' as const }
      if (saved.inputHash !== inputHash) throw new BannerOperationError(409, '同じ操作の入力が変わっています。保存結果を確認してください。')
      if (saved.state === 'completed') return { state: 'completed' as const, generation: await result(tx, userId, saved, cutoff) }
      return { state: saved.state }
    }
    const claim = disableLimits ? null : await reserveBannerMonthlyImages(userId, 1, tx)
    if (claim?.state === 'limit') return claim
    const reservation = claim?.state === 'reserved' ? claim.reservation : null
    const receipt: Receipt = { version: 1, inputHash, state: 'pending', startedAt: new Date().toISOString(), generationId: null, reservation: reservation ? { ...reservation, lastUsageReset: reservation.lastUsageReset.toISOString() } : null }
    await tx.systemSetting.create({ data: { key, value: JSON.stringify(receipt) } })
    return { state: 'started' as const }
  }, { isolationLevel: 'ReadCommitted', maxWait: 10000, timeout: 30000 })
}
export async function completeBannerRefinement(userId: string, operationId: string, inputHash: string, image: string, input: Omit<Input, 'originalImage'>, db: Db = prisma) {
  const key = keyFor(userId, operationId)
  if (!image.startsWith('data:image/png;base64,') || image.length > 32 * 1024 * 1024) throw new BannerOperationError(503, '修正画像を保存できませんでした。')
  return db.$transaction(async tx => {
    const saved = await lock(tx, userId, key)
    if (!saved || saved.inputHash !== inputHash || (saved.state !== 'pending' && saved.state !== 'completed')) throw new BannerOperationError(409, '保存対象の操作を確認できません。')
    if (saved.state === 'completed') return result(tx, userId, saved, new Date(0))
    const generation = await tx.generation.create({ data: { id: 'banner-refine-' + hash(key), userId, serviceId: 'banner', outputType: 'IMAGE', output: image, input: { instruction: input.instruction, keyword: input.instruction, category: input.category ?? 'other', size: input.size ?? '', kind: 'refine' }, metadata: { batchId: operationId, operationId, kind: 'refine', shared: false, pattern: 'A', inputHash } }, select: { id: true, output: true, createdAt: true } })
    await tx.systemSetting.update({ where: { key }, data: { value: JSON.stringify({ ...saved, state: 'completed', generationId: generation.id }) } })
    return generation
  }, { isolationLevel: 'ReadCommitted', maxWait: 10000, timeout: 30000 })
}
export async function failBannerRefinement(userId: string, operationId: string, inputHash: string, db: Db = prisma) {
  const key = keyFor(userId, operationId)
  return db.$transaction(async tx => {
    const saved = await lock(tx, userId, key)
    if (!saved || saved.inputHash !== inputHash) throw new BannerOperationError(409, '操作を確認できません。')
    if (saved.state !== 'pending') return saved.state
    const persisted = await tx.generation.findFirst({ where: { id: 'banner-refine-' + hash(key), userId, serviceId: 'banner' }, select: { id: true } })
    if (persisted) throw new BannerOperationError(409, '保存結果の整合性を確認できません。再生成せずお問い合わせください。')
    if (saved.reservation) {
      const subscription = await tx.userServiceSubscription.findUnique({ where: { id: saved.reservation.id }, select: { userId: true, serviceId: true } })
      if (subscription && (subscription.userId !== userId || subscription.serviceId !== 'banner')) throw new BannerOperationError(409, '操作の利用枠記録を確認できません。再生成せずお問い合わせください。')
      await releaseBannerMonthlyImages({ ...saved.reservation, lastUsageReset: new Date(saved.reservation.lastUsageReset) }, 1, tx)
    }
    await tx.systemSetting.update({ where: { key }, data: { value: JSON.stringify({ ...saved, state: 'failed', reservation: null }) } })
    return 'failed' as const
  }, { isolationLevel: 'ReadCommitted', maxWait: 10000, timeout: 30000 })
}
export async function recoverBannerRefinement(userId: string, operationId: string, cutoff: Date | null, db: Db = prisma) {
  const key = keyFor(userId, operationId)
  return db.$transaction(async tx => {
    const saved = await lock(tx, userId, key)
    if (!saved) return { state: 'missing' as const, generation: null }
    if (saved.state === 'completed') return { state: 'completed' as const, generation: await result(tx, userId, saved, cutoff) }
    return { state: saved.state, generation: null }
  }, { isolationLevel: 'ReadCommitted', maxWait: 10000, timeout: 30000 })
}

/** Fence only a request that has not been admitted. Pending provider work is never cancelled or refunded speculatively. */
export async function cancelMissingBannerRefinement(userId: string, operationId: string, cutoff: Date | null, db: Db = prisma) {
  const key = keyFor(userId, operationId)
  return db.$transaction(async tx => {
    const saved = await lock(tx, userId, key)
    if (saved) {
      if (saved.state === 'completed') return { state: 'completed' as const, generation: await result(tx, userId, saved, cutoff) }
      return { state: saved.state, generation: null }
    }
    const receipt: Receipt = { version: 1, inputHash: '0'.repeat(64), state: 'cancelled', startedAt: new Date().toISOString(), reservation: null, generationId: null }
    await tx.systemSetting.create({ data: { key, value: JSON.stringify(receipt) } })
    return { state: 'cancelled' as const, generation: null }
  }, { isolationLevel: 'ReadCommitted', maxWait: 10000, timeout: 30000 })
}
