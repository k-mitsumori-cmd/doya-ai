import { createHash } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import type { KintaiContext } from './types'
export class KintaiWorkRuleOperationError extends Error { constructor(public status: number, message: string) { super(message) } }

type Scope = Pick<KintaiContext, 'userId' | 'organizationId'>
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')

/** A creation is never sent without a recoverable operation identity. */
export function kintaiWorkRuleOperationId(value: unknown): string {
  if (typeof value !== 'string' || !UUID.test(value)) throw new KintaiWorkRuleOperationError(400, '操作情報が正しくありません。画面を開き直してください。')
  return value.toLowerCase()
}
function receiptKey(ctx: Scope, operationId: string) {
  if (!ctx.userId || !ctx.organizationId) throw new KintaiWorkRuleOperationError(403, '操作権限を確認できません。')
  return 'kintai-work-rule:v1:' + hash([ctx.userId, ctx.organizationId, operationId])
}
function parseReceipt(value: string) {
  let saved: unknown
  try { saved = JSON.parse(value) } catch { throw new KintaiWorkRuleOperationError(409, '保存記録を確認できません。一覧をご確認ください。') }
  const r = saved as { version?: unknown; state?: unknown; id?: unknown; inputHash?: unknown }
  if (r && typeof r === 'object' && !Array.isArray(r) && r.version === 2 && r.state === 'cancelled') return { state: 'cancelled' as const }
  if (!r || typeof r !== 'object' || Array.isArray(r) || r.version !== 1 || typeof r.id !== 'string' || !r.id || r.id.length > 128 || typeof r.inputHash !== 'string' || !/^[a-f0-9]{64}$/.test(r.inputHash)) {
    throw new KintaiWorkRuleOperationError(409, '保存記録を確認できません。一覧をご確認ください。')
  }
  return { state: 'created' as const, id: r.id, inputHash: r.inputHash }
}
async function lockedReceipt(tx: Prisma.TransactionClient, key: string) {
  // All creation/recovery operations take actor lock first, receipt lock second.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('kintai-work-rule:v1'), hashtext(${key}))`
  return tx.systemSetting.findUnique({ where: { key }, select: { value: true } })
}

/** Caller must hold fresh actor authority in this transaction before invoking this helper. */
export async function createKintaiWorkRuleOnce<T extends { id: string }>(
  tx: Prisma.TransactionClient, ctx: Scope, operationId: string,
  input: unknown, find: (id: string) => Promise<T | null>, create: () => Promise<T>,
): Promise<T> {
  const key = receiptKey(ctx, operationId), inputHash = hash(input)
  const receipt = await lockedReceipt(tx, key)
  if (receipt) {
    const saved = parseReceipt(receipt.value)
    if (saved.state === 'cancelled') throw new KintaiWorkRuleOperationError(409, 'この作成操作は取り消されています。入力を確認して新しく作成してください。')
    if (saved.inputHash !== inputHash) throw new KintaiWorkRuleOperationError(409, '同じ作成操作の入力が変わっています。一覧を確認してから新しく作成してください。')
    const row = await find(saved.id)
    if (!row) throw new KintaiWorkRuleOperationError(409, 'この作成操作のデータは現在開けません。一覧をご確認ください。')
    return row
  }
  const row = await create()
  await tx.systemSetting.create({ data: { key, value: JSON.stringify({ version: 1, id: row.id, inputHash }) } })
  // Do not delete receipts when the business row is deleted: replay must never resurrect it.
  return row
}

/** Read-only recovery waits behind any in-flight create with the same operation key. */
export async function recoverKintaiWorkRuleCreation<T>(
  tx: Prisma.TransactionClient, ctx: Scope, operationId: string, find: (id: string) => Promise<T | null>,
): Promise<{ state: 'missing' | 'unavailable' | 'cancelled'; row: null } | { state: 'found'; row: T }> {
  const receipt = await lockedReceipt(tx, receiptKey(ctx, operationId))
  if (!receipt) return { state: 'missing', row: null }
  const saved = parseReceipt(receipt.value)
  if (saved.state === 'cancelled') return { state: 'cancelled', row: null }
  const row = await find(saved.id)
  return row ? { state: 'found', row } : { state: 'unavailable', row: null }
}

/** Atomically fence a not-yet-arrived create; never deletes a committed business row. */
export async function cancelKintaiWorkRuleCreation<T>(
  tx: Prisma.TransactionClient, ctx: Scope, operationId: string, find: (id: string) => Promise<T | null>,
): Promise<{ state: 'cancelled' | 'unavailable'; row: null } | { state: 'found'; row: T }> {
  const key = receiptKey(ctx, operationId)
  const receipt = await lockedReceipt(tx, key)
  if (receipt) {
    const saved = parseReceipt(receipt.value)
    if (saved.state === 'cancelled') return { state: 'cancelled', row: null }
    const row = await find(saved.id)
    return row ? { state: 'found', row } : { state: 'unavailable', row: null }
  }
  await tx.systemSetting.create({ data: { key, value: JSON.stringify({ version: 2, state: 'cancelled' }) } })
  return { state: 'cancelled', row: null }
}
