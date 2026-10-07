import { createHash } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import type { SfaContext } from './types'
import { SfaMutationError } from './mutation-authority'

type Kind = 'task' | 'activity' | 'deal' | 'lead' | 'lead-import' | `conversion:${string}`
export class SfaReceiptRaceError extends Error { readonly code = 'SFA_RECEIPT_RACE' }
type Scope = Pick<SfaContext, 'userId' | 'organizationId'>
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')

/** Omission supports legacy clients; an explicitly invalid operation is never ignored. */
export function sfaOperationId(value: unknown): string | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'string' || !UUID.test(value)) throw new SfaMutationError(400, '操作情報が正しくありません。画面を開き直してください。')
  return value.toLowerCase()
}
function receiptKey(ctx: Scope, kind: Kind, operationId: string) {
  if (!ctx.userId || !ctx.organizationId) throw new SfaMutationError(403, '操作権限を確認できません。')
  return 'sfa-create:v1:' + hash([ctx.userId, ctx.organizationId, kind, operationId])
}
function parseReceipt(value: string) {
  let saved: unknown
  try { saved = JSON.parse(value) } catch { throw new SfaMutationError(409, '保存記録を確認できません。一覧をご確認ください。') }
  const r = saved as { version?: unknown; state?: unknown; id?: unknown; inputHash?: unknown }
  if (r && typeof r === 'object' && !Array.isArray(r) && r.version === 2 && r.state === 'cancelled') return { state: 'cancelled' as const }
  if (!r || typeof r !== 'object' || Array.isArray(r) || r.version !== 1 || typeof r.id !== 'string' || !r.id || r.id.length > 128 || typeof r.inputHash !== 'string' || !/^[a-f0-9]{64}$/.test(r.inputHash)) {
    throw new SfaMutationError(409, '保存記録を確認できません。一覧をご確認ください。')
  }
  return { state: 'created' as const, id: r.id, inputHash: r.inputHash }
}
async function lockedReceipt(tx: Prisma.TransactionClient, key: string) {
  // All creation/recovery operations take actor lock first, receipt lock second.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('sfa-create:v1'), hashtext(${key}))`
  return tx.systemSetting.findUnique({ where: { key }, select: { value: true } })
}

/** Caller must hold fresh actor authority in this transaction before invoking this helper. */
export async function createSfaOnce<T extends { id: string }>(
  tx: Prisma.TransactionClient, ctx: Scope, kind: Kind, operationId: string | undefined,
  input: unknown, find: (id: string) => Promise<T | null>, create: () => Promise<T>,
  options: { retrySerializableRace?: boolean } = {},
): Promise<T> {
  if (!operationId) return create()
  const key = receiptKey(ctx, kind, operationId), inputHash = hash(input)
  const receipt = await lockedReceipt(tx, key)
  if (receipt) {
    const saved = parseReceipt(receipt.value)
    if (saved.state === 'cancelled') throw new SfaMutationError(409, 'この作成操作は取り消されています。入力を確認して新しく作成してください。')
    if (saved.inputHash !== inputHash) throw new SfaMutationError(409, '同じ作成操作の入力が変わっています。一覧を確認してから新しく作成してください。')
    const row = await find(saved.id)
    if (!row) throw new SfaMutationError(409, 'この作成操作のデータは現在開けません。一覧をご確認ください。')
    return row
  }
  const row = await create()
  try {
    await tx.systemSetting.create({ data: { key, value: JSON.stringify({ version: 1, id: row.id, inputHash }) } })
  } catch (error) {
    const failure = error as { code?: string; meta?: { target?: unknown } }
    // A Serializable snapshot may predate a cancellation committed before our
    // advisory lock. Only a receipt-key conflict can trigger a fresh transaction.
    if (options.retrySerializableRace && failure?.code === 'P2002' && Array.isArray(failure.meta?.target) && failure.meta.target.length === 1 && failure.meta.target[0] === 'key') throw new SfaReceiptRaceError('保存操作の競合を再確認します。')
    throw error
  }
  // Do not delete receipts when the business row is deleted: replay must never resurrect it.
  return row
}

/** Read-only recovery waits behind any in-flight create with the same operation key. */
export async function recoverSfaCreation<T>(
  tx: Prisma.TransactionClient, ctx: Scope, kind: Kind, operationId: string, find: (id: string) => Promise<T | null>,
): Promise<{ state: 'missing' | 'unavailable' | 'cancelled'; row: null } | { state: 'found'; row: T }> {
  const receipt = await lockedReceipt(tx, receiptKey(ctx, kind, operationId))
  if (!receipt) return { state: 'missing', row: null }
  const saved = parseReceipt(receipt.value)
  if (saved.state === 'cancelled') return { state: 'cancelled', row: null }
  const row = await find(saved.id)
  return row ? { state: 'found', row } : { state: 'unavailable', row: null }
}

/** Atomically fence a not-yet-arrived create; never deletes a committed business row. */
export async function cancelSfaCreation<T>(
  tx: Prisma.TransactionClient, ctx: Scope, kind: Kind, operationId: string, find: (id: string) => Promise<T | null>,
): Promise<{ state: 'cancelled' | 'unavailable'; row: null } | { state: 'found'; row: T }> {
  const key = receiptKey(ctx, kind, operationId)
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
