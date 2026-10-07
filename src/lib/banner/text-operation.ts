import { createHash } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { reserveBannerTextCallInTransaction } from './text-budget'

type Db = Pick<typeof prisma, '$transaction'>
export type BannerTextKind = 'chat' | 'copy'
type Payload = Record<string, unknown>
type Receipt = { version: 1; inputHash: string; state: 'pending' | 'completed' | 'failed' | 'cancelled'; startedAt: string; result: Payload | null }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const HEX = /^[a-f0-9]{64}$/
const MAX_RESULT_BYTES = 65536
export class BannerTextOperationError extends Error { constructor(public status: number, message: string) { super(message) } }
export function bannerTextOperationId(value: unknown): string {
  if (typeof value !== 'string' || !UUID.test(value)) throw new BannerTextOperationError(400, '操作情報を確認できません。画面を開き直してください。')
  return value.toLowerCase()
}
export const bannerTextFingerprint = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
function keyFor(actor: string, kind: BannerTextKind, operationId: string) {
  if (!actor) throw new BannerTextOperationError(401, 'ログインが必要です。')
  if (!['chat', 'copy'].includes(kind)) throw new BannerTextOperationError(400, '操作の種類を確認できません。')
  return 'banner-text-operation:v1:' + bannerTextFingerprint([actor, kind, bannerTextOperationId(operationId)])
}
export function isValidBannerTextResult(value: unknown, kind: BannerTextKind): value is Payload {
  try {
    if (!value || typeof value !== 'object' || Array.isArray(value) || Buffer.byteLength(JSON.stringify(value), 'utf8') > MAX_RESULT_BYTES) return false
    const result = value as Payload
    const strings = (input: unknown, maximum: number, length: number, required = false) => Array.isArray(input) && input.length <= maximum && (!required || input.length > 0) && input.every(item => typeof item === 'string' && Boolean(item.trim()) && item.length <= length)
    if (kind === 'copy') return strings(result.suggestions, 12, 2000, true)
    if (typeof result.reply !== 'string' || !result.reply.trim() || result.reply.length > 4000) return false
    if (result.needsMoreInfo !== undefined && typeof result.needsMoreInfo !== 'boolean') return false
    if (result.questions != null && !strings(result.questions, 12, 2000)) return false
    if (result.suggestions !== undefined && !strings(result.suggestions, 12, 2000)) return false
    if (result.spec != null) {
      if (typeof result.spec !== 'object' || Array.isArray(result.spec)) return false
      const spec = result.spec as Payload
      if (!['purpose', 'category', 'size', 'keyword'].every(key => typeof spec[key] === 'string' && Boolean((spec[key] as string).trim()))) return false
      if ((spec.purpose as string).length > 32 || (spec.category as string).length > 32 || (spec.keyword as string).length > 200 || !/^\d{2,4}x\d{2,4}$/.test(spec.size as string)) return false
      const [width, height] = (spec.size as string).split('x').map(Number)
      if (width < 50 || height < 50 || width > 4096 || height > 4096) return false
      if (spec.imageDescription !== undefined && (typeof spec.imageDescription !== 'string' || spec.imageDescription.length > 300)) return false
      if (spec.brandColors !== undefined && (!Array.isArray(spec.brandColors) || spec.brandColors.length > 8 || !spec.brandColors.every(color => typeof color === 'string' && /^#[a-f0-9]{6}$/i.test(color)))) return false
    }
    return true
  } catch { return false }
}
function parse(value: string, kind: BannerTextKind): Receipt {
  try {
    if (Buffer.byteLength(value, 'utf8') > MAX_RESULT_BYTES + 2048) throw new Error()
    const saved: Receipt = JSON.parse(value)
    if (!saved || saved.version !== 1 || typeof saved.inputHash !== 'string' || !HEX.test(saved.inputHash) || !['pending', 'completed', 'failed', 'cancelled'].includes(saved.state) || typeof saved.startedAt !== 'string' || !Number.isFinite(Date.parse(saved.startedAt)) || (saved.state === 'completed' ? !isValidBannerTextResult(saved.result, kind) || Buffer.byteLength(JSON.stringify(saved.result), 'utf8') > MAX_RESULT_BYTES : saved.result !== null)) throw new Error()
    return saved
  } catch { throw new BannerTextOperationError(409, '保存された操作を確認できません。再実行せずお問い合わせください。') }
}
async function lock(tx: Prisma.TransactionClient, actor: string, key: string, kind: BannerTextKind) {
  const actors = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "User" WHERE id = ${actor} FOR SHARE`
  if (!actors.some(row => row.id === actor)) throw new BannerTextOperationError(403, '利用者情報を確認できません。ログインし直してください。')
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('banner-text-operation:v1'), hashtext(${key}))`
  const row = await tx.systemSetting.findUnique({ where: { key }, select: { value: true } })
  return row ? parse(row.value, kind) : null
}
const transactionOptions = { isolationLevel: 'ReadCommitted' as const, maxWait: 10000, timeout: 30000 }
export async function beginBannerTextOperation(actor: string, kind: BannerTextKind, operationId: string, inputHash: string, db: Db = prisma) {
  const key = keyFor(actor, kind, operationId)
  if (!HEX.test(inputHash)) throw new BannerTextOperationError(400, '入力内容を確認できません。')
  return db.$transaction(async tx => {
    const saved = await lock(tx, actor, key, kind)
    if (saved) {
      if (saved.state === 'cancelled') return { state: 'cancelled' as const }
      if (saved.inputHash !== inputHash) throw new BannerTextOperationError(409, '同じ操作の入力内容が変わっています。保存結果を確認してください。')
      if (saved.state === 'completed') return { state: 'completed' as const, result: saved.result! }
      return { state: saved.state }
    }
    const admission = await reserveBannerTextCallInTransaction(actor, tx)
    if (admission.state === 'limit') return admission
    const receipt: Receipt = { version: 1, inputHash, state: 'pending', startedAt: new Date().toISOString(), result: null }
    await tx.systemSetting.create({ data: { key, value: JSON.stringify(receipt) } })
    return { state: 'started' as const, usage: admission.usage }
  }, transactionOptions)
}
export async function completeBannerTextOperation(actor: string, kind: BannerTextKind, operationId: string, inputHash: string, result: Payload, db: Db = prisma) {
  const key = keyFor(actor, kind, operationId)
  if (!isValidBannerTextResult(result, kind) || Buffer.byteLength(JSON.stringify(result), 'utf8') > MAX_RESULT_BYTES) throw new BannerTextOperationError(503, 'AIの回答を保存できませんでした。')
  return db.$transaction(async tx => {
    const saved = await lock(tx, actor, key, kind)
    if (!saved || saved.inputHash !== inputHash || !['pending', 'completed'].includes(saved.state)) throw new BannerTextOperationError(409, '保存対象の操作を確認できません。')
    if (saved.state === 'completed') return saved.result!
    await tx.systemSetting.update({ where: { key }, data: { value: JSON.stringify({ ...saved, state: 'completed', result }) } })
    return result
  }, transactionOptions)
}
/** A text operation remains counted once. Never erase a pending/failed receipt to retry a provider. */
export async function failBannerTextOperation(actor: string, kind: BannerTextKind, operationId: string, inputHash: string, db: Db = prisma) {
  const key = keyFor(actor, kind, operationId)
  return db.$transaction(async tx => {
    const saved = await lock(tx, actor, key, kind)
    if (!saved || saved.inputHash !== inputHash) throw new BannerTextOperationError(409, '操作を確認できません。')
    if (saved.state !== 'pending') return saved.state
    await tx.systemSetting.update({ where: { key }, data: { value: JSON.stringify({ ...saved, state: 'failed' }) } })
    return 'failed' as const
  }, transactionOptions)
}
export async function recoverBannerTextOperation(actor: string, kind: BannerTextKind, operationId: string, cancelMissing = false, db: Db = prisma) {
  const key = keyFor(actor, kind, operationId)
  return db.$transaction(async tx => {
    const saved = await lock(tx, actor, key, kind)
    if (saved) return saved
    if (!cancelMissing) return { state: 'missing' as const, result: null }
    const receipt: Receipt = { version: 1, inputHash: '0'.repeat(64), state: 'cancelled', startedAt: new Date().toISOString(), result: null }
    await tx.systemSetting.create({ data: { key, value: JSON.stringify(receipt) } })
    return receipt
  }, transactionOptions)
}
