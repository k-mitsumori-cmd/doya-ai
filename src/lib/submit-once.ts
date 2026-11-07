// ============================================
// 新規の登録を、同じ送信につき1件だけにする（サーバー側）
// ============================================
// 通信に失敗したあとの送り直しで、同じ内容が2件できないようにする。
// - 受け取りの記録は既存の SystemSetting に入れ、登録と同じトランザクションで書く。DB の変更は要らない。
// - 番号（operationId）を付けない古い画面からの送信は、今までどおり登録する。
// - 同じ番号で中身が違う送信は、登録せずに止める。
// - 同じ番号と中身の送信は、新しく作らず、前にできた物を返す。
// 手本: src/lib/promane/client-creation.ts（プロマネの顧客の登録）
import { createHash } from 'node:crypto'
import type { Prisma } from '@prisma/client'

type Store = Pick<Prisma.TransactionClient, '$executeRaw' | 'systemSetting'>

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')

export interface OnceScope {
  /** 登録の種類（例: income-contract） */
  family: string
  /** 組織の ID */
  organizationId: string
  /** 送った人の ID（従業員の ID でもよい） */
  actorId: string
  /** 画面が付けた番号。古い画面からの送信では null */
  operationId: string | null
  /** 各 API の形の例外を作る（4xx で返すため） */
  fail: (status: number, message: string) => Error
}

export type OnceResolution = { state: 'found'; id: string } | { state: 'gone' } | { state: 'cancelled' }

type Receipt = { state: 'cancelled' } | { state: 'created'; id: string; inputHash: string }

/** body の operationId を確かめる。無ければ null、形が違えば止める */
export function onceOperationId(body: unknown, fail: OnceScope['fail']): string | null {
  const value = body && typeof body === 'object' ? (body as Record<string, unknown>).operationId : undefined
  if (value === undefined || value === null) return null
  if (typeof value !== 'string' || !UUID.test(value)) throw fail(400, '送信情報を確認できません。画面を読み込み直してください。')
  return value.toLowerCase()
}

/** 保存状態の確認の依頼か */
export function isOnceResolve(body: unknown): boolean {
  return Boolean(body && typeof body === 'object' && (body as Record<string, unknown>).onceAction === 'resolve')
}

/** 中身の比較には、番号と確認の指示を除いた送信の中身を使う */
function inputHashOf(input: unknown): string {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return hash(input)
  const { operationId: _op, onceAction: _action, ...rest } = input as Record<string, unknown>
  return hash(rest)
}

function keyOf(scope: OnceScope, operationId: string): string {
  return `submit-once:v1:${hash([scope.family, scope.organizationId, scope.actorId, operationId])}`
}

function parseReceipt(value: string, scope: OnceScope): Receipt {
  const bad = () => scope.fail(409, '保存の記録を確認できません。一覧をご確認ください。')
  let saved: unknown
  try { saved = JSON.parse(value) } catch { throw bad() }
  const row = saved && typeof saved === 'object' ? (saved as Record<string, unknown>) : null
  if (row?.version === 1 && row.state === 'cancelled') return { state: 'cancelled' }
  if (row?.version === 1 && row.state === 'created' && typeof row.id === 'string' && typeof row.inputHash === 'string') {
    return { state: 'created', id: row.id, inputHash: row.inputHash }
  }
  throw bad()
}

async function lockedReceipt(tx: Store, key: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('submit-once:v1'), hashtext(${key}))`
  return tx.systemSetting.findUnique({ where: { key }, select: { value: true } })
}

/**
 * 登録を1回だけ行う。呼び出す側のトランザクションの中で使う。
 * Serializable のトランザクションでは、同時の送信が受け取りの記録の一意制約（P2002）で失敗する。
 * 全部が巻き戻るので、呼び出す側のやり直し（runWithTxRetry・retryOnConflict）が、そのまま使える。
 */
export async function createOnce<T extends { id: string }>(
  tx: Store,
  scope: OnceScope,
  input: unknown,
  find: (id: string) => Promise<T | null>,
  create: () => Promise<T>,
): Promise<{ entry: T; replayed: boolean }> {
  if (!scope.operationId) return { entry: await create(), replayed: false }
  const key = keyOf(scope, scope.operationId)
  const inputHash = inputHashOf(input)
  const found = await lockedReceipt(tx, key)
  if (found) {
    const receipt = parseReceipt(found.value, scope)
    if (receipt.state === 'cancelled') throw scope.fail(409, 'この送信は取り消されています。内容を確かめて、もう一度お試しください。')
    if (receipt.inputHash !== inputHash) throw scope.fail(409, '同じ送信の内容が変わっています。一覧で保存の状態を確かめてください。')
    const entry = await find(receipt.id)
    if (!entry) throw scope.fail(409, 'この送信で登録した物を開けません。一覧をご確認ください。')
    return { entry, replayed: true }
  }
  const entry = await create()
  await tx.systemSetting.create({ data: { key, value: JSON.stringify({ version: 1, state: 'created', id: entry.id, inputHash }) } })
  return { entry, replayed: false }
}

/**
 * 通信に失敗した送信が保存されたかを確かめる。ここでは登録しない。
 * 保存されていなければ「取り消し」を記録する。遅れて届いた元の送信は、これで登録されなくなる。
 */
export async function resolveOnce(
  tx: Store,
  scope: OnceScope,
  find: (id: string) => Promise<{ id: string } | null>,
): Promise<OnceResolution> {
  if (!scope.operationId) throw scope.fail(400, '送信情報を確認できません。画面を読み込み直してください。')
  const key = keyOf(scope, scope.operationId)
  const found = await lockedReceipt(tx, key)
  if (found) {
    const receipt = parseReceipt(found.value, scope)
    if (receipt.state === 'cancelled') return { state: 'cancelled' }
    const entry = await find(receipt.id)
    return entry ? { state: 'found', id: entry.id } : { state: 'gone' }
  }
  await tx.systemSetting.create({ data: { key, value: JSON.stringify({ version: 1, state: 'cancelled' }) } })
  return { state: 'cancelled' }
}
