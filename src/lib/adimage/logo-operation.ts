import { validAdImageLogoContext, type AdImageLogoContext } from './logo-context'
import { createHash } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { withAdImageBudgetTransaction } from './image-budget'
import { AdImageLogoError } from './logo-input'
export { AdImageLogoError } from './logo-input'
import type { LogoConfig } from './logo'

export type AdImageLogoOperation = { actor: string; operationId: string; kind: 'logo-upload' | 'logo-remove'; targetId: string }
type Receipt = AdImageLogoOperation & { context?: AdImageLogoContext; version: 1; phase: 'pending' | 'completed' | 'failed' | 'cancelled'; inputHash: string | null; startedAt: string; expectedVersion: string | null; finishedVersion: string | null; path: string | null; config: LogoConfig | null; name: string | null }
type Tx = Prisma.TransactionClient
const LEASE = 330000
const hash = (value: string) => createHash('sha256').update(value).digest('hex')
const receiptKey = (r: AdImageLogoOperation) => 'adimage-logo-operation:v1:' + hash(JSON.stringify([r.actor, r.operationId]))
const activeKey = (actor: string) => 'adimage-logo-active:v1:' + hash(actor)
const validId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value)
const validDate = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value))
function normalized(input: AdImageLogoOperation) {
  if (!validId(input.actor) || !validId(input.targetId) || !['logo-upload', 'logo-remove'].includes(input.kind) || typeof input.operationId !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(input.operationId)) throw new AdImageLogoError(400, '操作情報を確認してください。')
  return { ...input, operationId: input.operationId.toLowerCase() }
}
function parse(value: string): Receipt {
  try {
    if (Buffer.byteLength(value) > 224 * 1024) throw new Error()
    const r: Receipt = JSON.parse(value); normalized(r)
    if (r.version !== 1 || !['pending', 'completed', 'failed', 'cancelled'].includes(r.phase) || !validDate(r.startedAt) || (r.inputHash !== null && !/^[a-f0-9]{64}$/.test(r.inputHash)) || (r.expectedVersion !== null && !validDate(r.expectedVersion)) || (r.finishedVersion !== null && !validDate(r.finishedVersion)) || (r.phase === 'pending' && (!r.inputHash || !r.expectedVersion)) || (r.phase === 'completed' && !r.finishedVersion)) throw new Error()
    if (r.kind === 'logo-remove' && (r.path !== null || r.config !== null || r.name !== null)) throw new Error()
    if (r.kind === 'logo-upload' && r.phase !== 'cancelled') {
      if (typeof r.path !== 'string' || r.path !== `${r.actor}/brand_${r.targetId}/logo_${r.operationId}.png` || typeof r.name !== 'string' || !r.name.trim() || r.name.length > 200 || !r.config || !['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center-top'].includes(r.config.pos) || !Number.isFinite(r.config.maxWidthPct) || r.config.maxWidthPct < 5 || r.config.maxWidthPct > 50 || !Number.isFinite(r.config.paddingPct) || r.config.paddingPct < 0 || r.config.paddingPct > 15) throw new Error()
    }
    if (r.context !== undefined && !validAdImageLogoContext(r.context)) throw new Error()
    return r
  } catch { throw new AdImageLogoError(409, '保存された操作情報を確認できません。再送せずお問い合わせください。') }
}
async function lockActor(tx: Tx, actor: string) {
  const users = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "User" WHERE id = ${actor} FOR UPDATE`
  if (!users.length) throw new AdImageLogoError(401, '再ログインして保存結果を確認してください。')
}
async function read(tx: Tx, input: AdImageLogoOperation) {
  const row = await tx.systemSetting.findUnique({ where: { key: receiptKey(input) }, select: { value: true } })
  if (!row) return null
  const r = parse(row.value)
  if (r.actor !== input.actor || r.operationId !== input.operationId || r.targetId !== input.targetId || r.kind !== input.kind) throw new AdImageLogoError(409, '操作対象が変わっています。保存結果を確認してください。')
  return r
}
async function save(tx: Tx, r: Receipt) {
  const value = JSON.stringify(r); parse(value)
  const key = receiptKey(r)
  await tx.systemSetting.upsert({ where: { key }, create: { key, value }, update: { value } })
}
async function close(tx: Tx, r: Receipt, phase: Receipt['phase'], finishedVersion: string | null = null) {
  const next = { ...r, phase, finishedVersion }; await save(tx, next)
  await tx.systemSetting.deleteMany({ where: { key: activeKey(r.actor), value: receiptKey(r) } })
  return next
}
async function expire(tx: Tx, r: Receipt) { return r.phase === 'pending' && Date.now() >= Date.parse(r.startedAt) + LEASE ? close(tx, r, 'failed') : r }
async function owned(tx: Tx, input: AdImageLogoOperation) {
  await tx.$queryRaw`SELECT id FROM adimage_brand WHERE id = ${input.targetId} AND "userId" = ${input.actor} FOR UPDATE`
  return tx.adImageBrand.findFirst({ where: { id: input.targetId, userId: input.actor }, select: { updatedAt: true, logoPath: true, logoConfig: true } })
}
async function result(tx: Tx, r: Receipt) {
  const brand = await owned(tx, r)
  const same = brand && (r.phase !== 'completed' || (brand.updatedAt.toISOString() === r.finishedVersion && brand.logoPath === r.path && (r.kind === 'logo-remove' || brand.logoConfig && r.config && typeof brand.logoConfig === 'object' && ['pos', 'maxWidthPct', 'paddingPct'].every(key => (brand.logoConfig as Record<string, unknown>)[key] === (r.config as unknown as Record<string, unknown>)[key]))))
  return { operationId: r.operationId, kind: r.kind, targetId: r.targetId, state: same ? r.phase : 'unavailable' as const, ...(same && r.phase === 'completed' ? { brandId: r.targetId, logoName: r.name, logoConfig: r.config, ...(r.context ? { logoContext: r.context } : {}) } : {}) }
}
/** Caller must hold the same User lock as image/analysis admission. */
export async function hasActiveAdImageLogo(tx: Tx, actor: string) {
  const active = await tx.systemSetting.findUnique({ where: { key: activeKey(actor) }, select: { value: true } })
  if (!active) return false
  const row = await tx.systemSetting.findUnique({ where: { key: active.value }, select: { value: true } })
  if (!row) throw new AdImageLogoError(409, 'ロゴの保存結果を確認してください。')
  const r = parse(row.value)
  if (r.actor !== actor || receiptKey(r) !== active.value) throw new AdImageLogoError(409, 'ロゴの操作情報を確認してください。')
  return (await expire(tx, r)).phase === 'pending'
}
export async function beginAdImageLogo(supplied: AdImageLogoOperation, inputHash: string, config: LogoConfig | null, name: string | null, context?: AdImageLogoContext) {
  const input = normalized(supplied)
  if (!/^[a-f0-9]{64}$/.test(inputHash)) throw new AdImageLogoError(400, '操作内容を確認してください。')
  return withAdImageBudgetTransaction(async tx => {
    await lockActor(tx, input.actor)
    const prior = await read(tx, input)
    if (prior) {
      if (prior.inputHash !== null && prior.inputHash !== inputHash) throw new AdImageLogoError(409, '同じ操作番号で内容を変更できません。保存結果を確認してください。')
      return { admitted: false as const, value: await result(tx, await expire(tx, prior)) }
    }
    if (await hasActiveAdImageLogo(tx, input.actor)) throw new AdImageLogoError(409, 'ロゴを保存中です。保存結果を確認してください。')
    const { hasActiveAdImageOperation } = await import('./image-operation')
    if (await hasActiveAdImageOperation(tx, input.actor)) throw new AdImageLogoError(409, '別の処理が進んでいます。保存結果を確認してください。')
    const brand = await owned(tx, input)
    if (!brand) throw new AdImageLogoError(404, 'ブランドが見つかりません。')
    const receipt: Receipt = { ...input, ...(context ? { context } : {}), version: 1, phase: 'pending', inputHash, startedAt: new Date().toISOString(), expectedVersion: brand.updatedAt.toISOString(), finishedVersion: null, path: input.kind === 'logo-upload' ? `${input.actor}/brand_${input.targetId}/logo_${input.operationId}.png` : null, config, name }
    await save(tx, receipt)
    await tx.systemSetting.upsert({ where: { key: activeKey(input.actor) }, create: { key: activeKey(input.actor), value: receiptKey(input) }, update: { value: receiptKey(input) } })
    return { admitted: true as const, receipt }
  })
}
export async function finishAdImageLogo(supplied: AdImageLogoOperation) {
  const input = normalized(supplied)
  return withAdImageBudgetTransaction(async tx => {
    await lockActor(tx, input.actor)
    const original = await read(tx, input)
    if (!original) throw new AdImageLogoError(409, '操作の受付記録がありません。保存結果を確認してください。')
    const r = await expire(tx, original)
    if (r.phase !== 'pending') return result(tx, r)
    const brand = await owned(tx, input)
    if (!brand || brand.updatedAt.toISOString() !== r.expectedVersion) return result(tx, await close(tx, r, 'failed'))
    const updatedAt = new Date(Math.max(Date.now(), brand.updatedAt.getTime() + 1))
    const updated = await tx.adImageBrand.updateMany({ where: { id: input.targetId, userId: input.actor, updatedAt: brand.updatedAt }, data: { logoPath: r.path, ...(r.config ? { logoConfig: { ...r.config } } : {}), updatedAt } })
    if (updated.count !== 1) throw new AdImageLogoError(409, 'ブランドが更新されています。保存結果を確認してください。')
    return result(tx, await close(tx, r, 'completed', updatedAt.toISOString()))
  })
}
export async function failAdImageLogo(supplied: AdImageLogoOperation) {
  const input = normalized(supplied)
  return withAdImageBudgetTransaction(async tx => {
    await lockActor(tx, input.actor)
    const original = await read(tx, input)
    if (original?.phase === 'pending') await close(tx, original, 'failed')
  })
}
export async function recoverAdImageLogo(supplied: AdImageLogoOperation, cancel = false) {
  const input = normalized(supplied)
  return withAdImageBudgetTransaction(async tx => {
    await lockActor(tx, input.actor)
    let r = await read(tx, input)
    if (!r && cancel) { r = { ...input, version: 1, phase: 'cancelled', inputHash: null, startedAt: new Date().toISOString(), expectedVersion: null, finishedVersion: null, path: null, config: null, name: null }; await save(tx, r) }
    return r ? result(tx, await expire(tx, r)) : { operationId: input.operationId, kind: input.kind, targetId: input.targetId, state: 'missing' as const }
  })
}
