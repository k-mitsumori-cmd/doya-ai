import { createHash } from 'node:crypto'
import type { Prisma } from '@prisma/client'

export class PromaneTaskCreationError extends Error {}
export class PromaneTaskReceiptRace extends Error { readonly code = 'PROMANE_CLIENT_RECEIPT_RACE' }
export type PromaneTaskCreationScope = { workspaceId: string; userId: string; projectId: string }
type Store = Prisma.TransactionClient
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function promaneTaskOperationId(value: unknown): string {
  if (typeof value !== 'string' || !UUID.test(value)) throw new PromaneTaskCreationError('送信情報を確認できません。画面を読み込み直してください。')
  return value.toLowerCase()
}
function receiptKey(scope: PromaneTaskCreationScope, operationId: string) {
  if (!scope.workspaceId || !scope.userId || !scope.projectId) throw new PromaneTaskCreationError('タスクの操作権限を確認できません。')
  return 'promane-task:v1:' + hash([scope.workspaceId, scope.userId, scope.projectId, promaneTaskOperationId(operationId)])
}
function parseReceipt(value: string): { state: 'cancelled' } | { state: 'created'; id: string; inputHash: string } {
  let saved: unknown
  try { saved = JSON.parse(value) } catch { throw new PromaneTaskCreationError('保存記録を確認できません。タスクの一覧をご確認ください。') }
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) throw new PromaneTaskCreationError('保存記録を確認できません。タスクの一覧をご確認ください。')
  const row = saved as Record<string, unknown>
  if (row.version === 1 && row.state === 'cancelled') return { state: 'cancelled' }
  if (row.version !== 1 || row.state !== 'created' || typeof row.id !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(row.id) || typeof row.inputHash !== 'string' || !/^[a-f0-9]{64}$/.test(row.inputHash)) {
    throw new PromaneTaskCreationError('保存記録を確認できません。タスクの一覧をご確認ください。')
  }
  return { state: 'created', id: row.id, inputHash: row.inputHash }
}
async function lockedReceipt(tx: Store, key: string, userId: string, operationId: string) {
  // Serialize delayed legacy writes against an explicit actor-wide cancellation.
  const globalKey = 'promane-legacy-cancel:v1:' + hash(['task', userId, promaneTaskOperationId(operationId)])
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('promane-legacy-cancel:v1'), hashtext(${globalKey}))`
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('promane-task:v1'), hashtext(${key}))`
  const receipt = await tx.systemSetting.findUnique({ where: { key }, select: { value: true } })
  // A saved local receipt takes precedence: cancellation never erases committed data.
  return receipt || tx.systemSetting.findUnique({ where: { key: globalKey }, select: { value: true } })
}
async function recordReceipt(tx: Store, key: string, value: string) {
  try { await tx.systemSetting.create({ data: { key, value } }) }
  catch (error) {
    // Serializable snapshots can predate a concurrent receipt even after the advisory lock.
    // Throw a dedicated signal; caller retries the whole rolled-back transaction, never a committed write.
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') throw new PromaneTaskReceiptRace('保存記録の競合を確認しています。')
    throw error
  }
}
/** Caller must hold a fresh writable actor lock before calling; business row and receipt commit together. */
export async function createPromaneTaskOnce<T extends { id: string }>(
  tx: Store, scope: PromaneTaskCreationScope, operationId: string, input: unknown,
  find: (id: string) => Promise<T | null>, create: () => Promise<T>,
): Promise<T> {
  const key = receiptKey(scope, operationId), inputHash = hash(input)
  const receipt = await lockedReceipt(tx, key, scope.userId, operationId)
  if (receipt) {
    const saved = parseReceipt(receipt.value)
    if (saved.state === 'cancelled') throw new PromaneTaskCreationError('この送信は取り消されています。入力を確認して新しく記録してください。')
    if (saved.inputHash !== inputHash) throw new PromaneTaskCreationError('同じ送信の入力が変わっています。保存状態を確認してください。')
    const entry = await find(saved.id)
    if (!entry) throw new PromaneTaskCreationError('この送信の記録は現在開けません。タスクの一覧をご確認ください。')
    return entry
  }
  const entry = await create()
  await recordReceipt(tx, key, JSON.stringify({ version: 1, state: 'created', id: entry.id, inputHash }))
  return entry
}
/** Recovery never creates a task. Cancelling a missing operation fences a delayed original request. */
export async function recoverPromaneTask<T>(
  tx: Store, scope: PromaneTaskCreationScope, operationId: string, find: (id: string) => Promise<T | null>, cancelIfMissing = false,
): Promise<{ state: 'found'; entry: T } | { state: 'missing' | 'cancelled' | 'unavailable'; entry: null }> {
  const key = receiptKey(scope, operationId)
  const receipt = await lockedReceipt(tx, key, scope.userId, operationId)
  if (receipt) {
    const saved = parseReceipt(receipt.value)
    if (saved.state === 'cancelled') return { state: 'cancelled', entry: null }
    const entry = await find(saved.id)
    return entry ? { state: 'found', entry } : { state: 'unavailable', entry: null }
  }
  if (!cancelIfMissing) return { state: 'missing', entry: null }
  await recordReceipt(tx, key, JSON.stringify({ version: 1, state: 'cancelled' }))
  return { state: 'cancelled', entry: null }
}
export function isPromaneTaskReceiptConflict(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('code' in error)) return false
  if (error.code === 'PROMANE_CLIENT_RECEIPT_RACE' || error.code === 'P2034') return true
  return error.code === 'P2010' && 'meta' in error && !!error.meta && typeof error.meta === 'object'
    && 'code' in error.meta && (error.meta.code === '40001' || error.meta.code === '40P01')
}
