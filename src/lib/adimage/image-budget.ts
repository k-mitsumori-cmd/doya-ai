import { createHash, randomUUID } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  DAILY_CONCEPT_LIMIT, DAILY_IMAGE_LIMIT, MAX_PLACEMENTS_PER_RUN, MONTHLY_IMAGE_LIMIT,
  ownerWhere, quotaDenied, limitMessage,
  type AdImageIdentity, type AdImageQuotaDenied,
} from './access'

type Tx = Prisma.TransactionClient
type Slot = { day: string; month: string; images: number; concepts: number; at: number }
type State = {
  version: 1; day: string; month: string; dayImages: number; monthImages: number; dayConcepts: number
  reservations: Record<string, Slot>
}
export type ImageBudgetReservation = { key: string; token: string; requested: number }
type Claim = { ok: true; reservation: ImageBudgetReservation } | AdImageQuotaDenied
const STALE_MS = 15 * 60 * 1000 // maxDuration=300秒。保存と精算は同一トランザクション。

function periods(now = Date.now()) {
  const day = new Date(now + 9 * 3600_000).toISOString().slice(0, 10)
  return { day, month: day.slice(0, 7) }
}

function parseState(value: string): State {
  const s = JSON.parse(value) as State
  if (!s || s.version !== 1 || typeof s.day !== 'string' || typeof s.month !== 'string' ||
    !Number.isSafeInteger(s.dayImages) || s.dayImages < 0 ||
    !Number.isSafeInteger(s.monthImages) || s.monthImages < 0 ||
    !Number.isSafeInteger(s.dayConcepts) || s.dayConcepts < 0 ||
    !s.reservations || typeof s.reservations !== 'object' || Array.isArray(s.reservations)) {
    throw new Error('AdImage budget state is invalid')
  }
  for (const slot of Object.values(s.reservations)) {
    if (!slot || typeof slot.day !== 'string' || typeof slot.month !== 'string' ||
      !Number.isSafeInteger(slot.images) || slot.images < 1 ||
      !Number.isSafeInteger(slot.concepts) || slot.concepts < 0 || slot.concepts > 1 ||
      !Number.isFinite(slot.at)) throw new Error('AdImage budget reservation is invalid')
  }
  return s
}

function normalize(s: State, now: number): State {
  const { day, month } = periods(now)
  const next: State = { ...s, reservations: { ...s.reservations } }
  if (next.month !== month) { next.month = month; next.monthImages = 0 }
  if (next.day !== day) { next.day = day; next.dayImages = 0; next.dayConcepts = 0 }
  for (const [token, slot] of Object.entries(next.reservations)) {
    if (slot.at > now - STALE_MS) continue
    // 出力保存と台帳の精算は同時コミット。未精算の期限切れ予約には保存済み画像が無い。
    if (slot.day === next.day) { next.dayImages = Math.max(0, next.dayImages - slot.images); next.dayConcepts = Math.max(0, next.dayConcepts - slot.concepts) }
    if (slot.month === next.month) next.monthImages = Math.max(0, next.monthImages - slot.images)
    delete next.reservations[token]
  }
  return next
}

async function baseline(tx: Tx, id: AdImageIdentity, now: number): Promise<State> {
  const where = ownerWhere(id)
  if (!where) throw new Error('AdImage identity is required')
  const { day, month } = periods(now)
  const dayStart = new Date(`${day}T00:00:00.000Z`).getTime() - 9 * 3600_000
  const monthStart = new Date(`${month}-01T00:00:00.000Z`).getTime() - 9 * 3600_000
  const [dayImages, monthImages, dayConcepts] = await Promise.all([
    tx.adImageCreative.count({ where: { concept: { campaign: where }, createdAt: { gte: new Date(dayStart) } } }),
    tx.adImageCreative.count({ where: { concept: { campaign: where }, createdAt: { gte: new Date(monthStart) } } }),
    tx.adImageConcept.count({ where: { campaign: where, createdAt: { gte: new Date(dayStart) } } }),
  ])
  return { version: 1, ...periods(now), dayImages, monthImages, dayConcepts, reservations: {} }
}

async function serializable<T>(fn: (tx: Tx) => Promise<T>, retryUnique = false): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await prisma.$transaction(fn, { isolationLevel: 'Serializable', maxWait: 10000, timeout: 30000 })
    } catch (error) {
      const code = (error as { code?: string })?.code
      if ((code !== 'P2034' && !(retryUnique && code === 'P2002')) || attempt === 4) throw error
    }
  }
  throw new Error('AdImage budget retry exhausted')
}

/** 実費が発生する前に画像と新規コンセプトの枠を予約する。削除済み履歴でも消費枠は残る。 */
export async function claimImageBudget(id: AdImageIdentity, requested: number, newConcept: boolean): Promise<Claim> {
  if (!id.userId) throw new Error('AdImage budget requires an account')
  if (!Number.isSafeInteger(requested) || requested < 1 || requested > MAX_PLACEMENTS_PER_RUN) {
    return quotaDenied(`一度に生成できるのは${MAX_PLACEMENTS_PER_RUN}枚までです。配置やパターン数を減らしてください。`,
      'REQUEST_IMAGE_LIMIT', id.plan, { period: 'request', unit: 'image', limit: MAX_PLACEMENTS_PER_RUN, used: 0, requested })
  }
  const key = `adimage-image:v1:${createHash('sha256').update(id.userId).digest('hex')}`
  const token = randomUUID()
  return serializable(async (tx) => {
    const now = Date.now()
    const row = await tx.systemSetting.findUnique({ where: { key }, select: { value: true } })
    const state = row ? normalize(parseState(row.value), now) : await baseline(tx, id, now)
    const daily = DAILY_IMAGE_LIMIT[id.plan]
    const monthly = MONTHLY_IMAGE_LIMIT[id.plan]
    const concepts = DAILY_CONCEPT_LIMIT[id.plan]
    let denied: AdImageQuotaDenied | null = null
    if (daily != null && state.dayImages + requested > daily) {
      denied = quotaDenied(limitMessage(id.plan, '1日', daily, state.dayImages, '本日'), 'DAILY_IMAGE_LIMIT', id.plan,
        { period: 'day', unit: 'image', limit: daily, used: state.dayImages, requested })
    } else if (monthly != null && state.monthImages + requested > monthly) {
      denied = quotaDenied(limitMessage(id.plan, '月', monthly, state.monthImages, '今月'), 'MONTHLY_IMAGE_LIMIT', id.plan,
        { period: 'month', unit: 'image', limit: monthly, used: state.monthImages, requested })
    } else if (newConcept && state.dayConcepts >= concepts) {
      denied = quotaDenied(id.plan === 'PRO' ? '本日の生成上限に達しました。明日また実行できます。' :
        '本日の生成上限に達しました。明日また実行できます。プロプランで上限を増やせます。',
      'DAILY_CONCEPT_LIMIT', id.plan, { period: 'day', unit: 'concept', limit: concepts, used: state.dayConcepts, requested: 1 })
    }
    if (!denied) {
      state.dayImages += requested; state.monthImages += requested
      if (newConcept) state.dayConcepts++
      state.reservations[token] = { ...periods(now), images: requested, concepts: newConcept ? 1 : 0, at: now }
    }
    if (row) await tx.systemSetting.update({ where: { key }, data: { value: JSON.stringify(state) } })
    else await tx.systemSetting.create({ data: { key, value: JSON.stringify(state) } })
    return denied || { ok: true as const, reservation: { key, token, requested } }
  }, true)
}

/** 画像の保存と使用量の確定を原子的に行う。失敗時には保存も精算もコミットしない。 */
export async function settleImageBudget<T>(reservation: ImageBudgetReservation, produced: number, write: (tx: Tx) => Promise<T>): Promise<T> {
  if (!Number.isSafeInteger(produced) || produced < 1 || produced > reservation.requested) throw new Error('AdImage result count is invalid')
  return serializable(async (tx) => {
    const row = await tx.systemSetting.findUnique({ where: { key: reservation.key }, select: { value: true } })
    if (!row) throw new Error('AdImage reservation missing')
    const state = normalize(parseState(row.value), Date.now())
    const slot = state.reservations[reservation.token]
    if (!slot || slot.images !== reservation.requested) throw new Error('AdImage reservation expired')
    const result = await write(tx)
    const refund = slot.images - produced
    if (slot.day === state.day) state.dayImages -= refund
    if (slot.month === state.month) state.monthImages -= refund
    delete state.reservations[reservation.token]
    await tx.systemSetting.update({ where: { key: reservation.key }, data: { value: JSON.stringify(state) } })
    return result
  })
}

/** 失敗・部分未保存の予約を返す。確定済みまたは期限切れなら何もしない。 */
export async function releaseImageBudget(reservation: ImageBudgetReservation): Promise<void> {
  await serializable(async (tx) => {
    const row = await tx.systemSetting.findUnique({ where: { key: reservation.key }, select: { value: true } })
    if (!row) return
    const state = normalize(parseState(row.value), Date.now())
    const slot = state.reservations[reservation.token]
    if (!slot) return
    if (slot.day === state.day) { state.dayImages -= slot.images; state.dayConcepts -= slot.concepts }
    if (slot.month === state.month) state.monthImages -= slot.images
    delete state.reservations[reservation.token]
    await tx.systemSetting.update({ where: { key: reservation.key }, data: { value: JSON.stringify(state) } })
  })
}

export async function readImageBudgetUsage(userId: string): Promise<{ today: number; month: number } | null> {
  const key = `adimage-image:v1:${createHash('sha256').update(userId).digest('hex')}`
  const row = await prisma.systemSetting.findUnique({ where: { key }, select: { value: true } })
  if (!row) return null
  const state = normalize(parseState(row.value), Date.now())
  return { today: state.dayImages, month: state.monthImages }
}
