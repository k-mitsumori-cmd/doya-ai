import { createHash } from 'node:crypto'
import type { Prisma, PrismaClient, SeoArticle } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { jstMonthRange, seoMonthlyArticleLimit, type SeoPlanCode } from '@/lib/seoAccess'

export class SeoArticleQuotaError extends Error {
  readonly upgradeAvailable: boolean

  constructor(readonly limit: number, readonly guest: boolean, plan: SeoPlanCode = 'GUEST') {
    super('SEO article quota reached')
    this.upgradeAvailable = !guest && (plan === 'FREE' || plan === 'LIGHT')
  }
}

export class SeoArticleNotFoundError extends Error {
  constructor() { super('SEO article not found') }
}

export function seoArticleUsageKey(userId: string, now: Date): string {
  const month = new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 7)
  return `seo-article-usage:v1:${createHash('sha256').update(userId).digest('hex')}:${month}`
}

export async function getSeoArticleMonthlyUsage(db: Prisma.TransactionClient, userId: string, now = new Date()): Promise<number> {
  const { start, end } = jstMonthRange(now)
  const key = seoArticleUsageKey(userId, now)
  const [savedArticles, ledger] = await Promise.all([
    db.seoArticle.count({ where: { userId, createdAt: { gte: start, lt: end } } }),
    db.systemSetting.findUnique({ where: { key }, select: { value: true } }),
  ])
  if (ledger && !/^\d+$/.test(ledger.value)) throw new Error('SEO usage ledger invalid')
  const ledgerCount = ledger ? Number(ledger.value) : 0
  if (!Number.isSafeInteger(ledgerCount)) throw new Error('SEO usage ledger invalid')
  return Math.max(savedArticles, ledgerCount)
}

/** Admin list equivalent of getSeoArticleMonthlyUsage, using two queries for all users. */
export async function getSeoArticleMonthlyUsageForUsers(db: Prisma.TransactionClient, userIds: string[], now = new Date()): Promise<Map<string, number>> {
  const ids = [...new Set(userIds)]
  if (ids.length === 0) return new Map()
  const { start, end } = jstMonthRange(now)
  const keyByUser = new Map(ids.map(id => [id, seoArticleUsageKey(id, now)]))
  const [articles, ledgers] = await Promise.all([
    db.seoArticle.groupBy({
      by: ['userId'],
      where: { userId: { in: ids }, createdAt: { gte: start, lt: end } },
      _count: { _all: true },
    }),
    db.systemSetting.findMany({
      where: { key: { in: [...keyByUser.values()] } },
      select: { key: true, value: true },
    }),
  ])
  const counts = new Map(ids.map(id => [id, 0]))
  for (const row of articles) {
    if (row.userId) counts.set(row.userId, row._count._all)
  }
  const userByKey = new Map([...keyByUser].map(([userId, key]) => [key, userId]))
  for (const ledger of ledgers) {
    if (!/^\d+$/.test(ledger.value)) throw new Error('SEO usage ledger invalid')
    const count = Number(ledger.value)
    if (!Number.isSafeInteger(count)) throw new Error('SEO usage ledger invalid')
    const userId = userByKey.get(ledger.key)
    if (userId) counts.set(userId, Math.max(counts.get(userId) ?? 0, count))
  }
  return counts
}

export class SeoArticleOperationError extends Error {
  constructor(readonly status: 400 | 409 | 429, message: string) { super(message) }
}
const SEO_OPERATION_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const seoSavedId = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value)
export function seoArticleOperationId(value: unknown): string | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'string' || !SEO_OPERATION_UUID.test(value)) throw new SeoArticleOperationError(400, '操作情報を確認できません。画面を開き直してください。')
  return value.toLowerCase()
}
function seoArticleOperationKey(userId: string, operationId: string) {
  return 'seo-article-create:v1:' + createHash('sha256').update(JSON.stringify([userId, operationId])).digest('hex')
}
function seoInputHash(value: unknown) {
  const sort = (input: any): any => Array.isArray(input) ? input.map(sort) : input && typeof input === 'object' ? Object.fromEntries(Object.keys(input).sort().map(key => [key, sort(input[key])])) : input
  return createHash('sha256').update(JSON.stringify(sort(JSON.parse(JSON.stringify(value))))).digest('hex')
}
type SeoCreationReceipt = { version: 1; state: 'created'; inputHash: string; articleId: string; jobId: string | null } | { version: 2; state: 'cancelled' }
function parseSeoCreationReceipt(value: string): SeoCreationReceipt {
  let input: any
  try { input = JSON.parse(value) } catch { throw new SeoArticleOperationError(409, '作成記録を確認できません。記事一覧をご確認ください。') }
  if (input && !Array.isArray(input) && input.version === 2 && input.state === 'cancelled') return input
  if (!input || Array.isArray(input) || input.version !== 1 || input.state !== 'created' || typeof input.inputHash !== 'string' || !/^[a-f0-9]{64}$/.test(input.inputHash) || !seoSavedId(input.articleId) || !(input.jobId === null || seoSavedId(input.jobId))) throw new SeoArticleOperationError(409, '作成記録を確認できません。記事一覧をご確認ください。')
  return input
}
async function findSeoCreatedRows(tx: Prisma.TransactionClient, userId: string, receipt: Extract<SeoCreationReceipt, { state: 'created' }>) {
  const article = await tx.seoArticle.findFirst({ where: { id: receipt.articleId, userId } })
  if (!article) return null
  const job = receipt.jobId ? await tx.seoJob.findFirst({ where: { id: receipt.jobId, articleId: article.id } }) : null
  if (receipt.jobId && !job) return null
  return { article, job }
}
/** Recovery/cancellation share creation's actor lock. Missing alone does not authorize a fresh operation. */
export async function recoverSeoArticleCreation(userId: string, operationId: string, cancel = false, db: PrismaClient = prisma) {
  const id = seoArticleOperationId(operationId)
  if (!userId || !id) throw new SeoArticleOperationError(400, '操作情報を確認できません。')
  return db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'seo-article:' + userId}))`
    const key = seoArticleOperationKey(userId, id)
    const row = await tx.systemSetting.findUnique({ where: { key }, select: { value: true } })
    if (!row) {
      if (!cancel) return { state: 'missing' as const, articleId: null, jobId: null }
      // Only a new missing-operation fence uses this operational pool. Reads and existing receipts remain recoverable.
      const budgetKey = 'seo-article-cancel-budget:v1:' + createHash('sha256').update(userId).digest('hex')
      const day = new Date(new Date().getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
      const budget = await tx.systemSetting.findUnique({ where: { key: budgetKey }, select: { value: true } })
      const parsed = budget?.value.match(/^(\d{4}-\d{2}-\d{2}):(\d+)$/)
      const previous = parsed ? Number(parsed[2]) : 0
      if ((budget && !parsed) || !Number.isSafeInteger(previous)) throw new Error('SEO creation cancellation budget invalid')
      const used = parsed?.[1] === day ? previous : 0
      if (used >= 100) throw new SeoArticleOperationError(429, '未受付の操作を終了できる回数が本日の上限（100回）に達しました。日本時間の午前0時以降に再確認してください。')
      const value = `${day}:${used + 1}`
      await tx.systemSetting.upsert({ where: { key: budgetKey }, create: { key: budgetKey, value }, update: { value } })
      await tx.systemSetting.create({ data: { key, value: JSON.stringify({ version: 2, state: 'cancelled' }) } })
      return { state: 'cancelled' as const, articleId: null, jobId: null }
    }
    const receipt = parseSeoCreationReceipt(row.value)
    if (receipt.state === 'cancelled') return { state: 'cancelled' as const, articleId: null, jobId: null }
    const result = await findSeoCreatedRows(tx, userId, receipt)
    return result ? { state: 'found' as const, articleId: result.article.id, jobId: result.job?.id ?? null } : { state: 'unavailable' as const, articleId: null, jobId: null }
  }, { timeout: 15000 })
}

type CreateArgs = {
  operationId?: string

  userId: string | null
  guestId: string | null
  plan: SeoPlanCode
  articleData: Omit<Prisma.SeoArticleUncheckedCreateInput, 'userId' | 'guestId'>
  createJob: boolean
  afterCreate?: (tx: Prisma.TransactionClient, article: SeoArticle) => Promise<void>
}

/** Both SEO creation routes share this serialized monthly admission and atomic article/job save. */
export async function createSeoArticleWithinLimit(args: CreateArgs, db: PrismaClient = prisma) {
  const { userId, guestId, plan, articleData, createJob, afterCreate } = args
  const operationId = seoArticleOperationId(args.operationId)
  if (!userId) throw new SeoArticleQuotaError(0, true)

  return db.$transaction(async (tx) => {
    // The lock covers both creation routes. Count-after-lock sees the previous request's commit.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'seo-article:' + userId}))`
    const receiptKey = operationId ? seoArticleOperationKey(userId, operationId) : null
    const inputHash = receiptKey ? seoInputHash({ articleData, createJob }) : null
    if (receiptKey) {
      const saved = await tx.systemSetting.findUnique({ where: { key: receiptKey }, select: { value: true } })
      if (saved) {
        const receipt = parseSeoCreationReceipt(saved.value)
        if (receipt.state === 'cancelled') throw new SeoArticleOperationError(409, 'この作成操作は終了しています。新しい操作を始めてください。')
        if (receipt.inputHash !== inputHash) throw new SeoArticleOperationError(409, '同じ作成操作の入力が変わっています。記事一覧をご確認ください。')
        const result = await findSeoCreatedRows(tx, userId, receipt)
        if (!result) throw new SeoArticleOperationError(409, '作成済みの記事を現在開けません。記事一覧をご確認ください。')
        return { ...result, replayed: true }
      }
    }
    const now = new Date()
    const key = seoArticleUsageKey(userId, now)
    const used = await getSeoArticleMonthlyUsage(tx, userId, now)
    const limit = seoMonthlyArticleLimit(plan)
    if (limit >= 0 && used >= limit) throw new SeoArticleQuotaError(limit, false, plan)
    // Use the same post-lock time for admission and creation, including at a JST month boundary.
    const article = await tx.seoArticle.create({ data: { ...articleData, userId, guestId: null, createdAt: now } })
    const job = createJob ? await tx.seoJob.create({ data: { articleId: article.id, status: 'queued', step: 'init', progress: 0 } }) : null
    if (afterCreate) await afterCreate(tx, article)
    await tx.systemSetting.upsert({ where: { key }, create: { key, value: String(used + 1) }, update: { value: String(used + 1) } })
    if (receiptKey) await tx.systemSetting.create({ data: { key: receiptKey, value: JSON.stringify({ version: 1, state: 'created', inputHash, articleId: article.id, jobId: job?.id ?? null }) } })
    return { article, job, replayed: false }
  }, { timeout: 15000 })
}

/** A draft's first job is included in its creation; later full regenerations use the monthly pool. */
export async function runSeoArticleRegenerationWithinLimit<T>(args: {
  userId: string
  articleId: string
  plan: SeoPlanCode
  action: (tx: Prisma.TransactionClient) => Promise<T>
}, db: PrismaClient = prisma): Promise<T> {
  const { userId, articleId, plan, action } = args
  return db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'seo-article:' + userId}))`
    const article = await tx.seoArticle.findFirst({ where: { id: articleId, userId }, select: { id: true } })
    if (!article) throw new SeoArticleNotFoundError()
    const previousJobs = await tx.seoJob.count({ where: { articleId } })
    const isRegeneration = previousJobs > 0
    const now = new Date()
    const key = seoArticleUsageKey(userId, now)
    const used = isRegeneration ? await getSeoArticleMonthlyUsage(tx, userId, now) : 0
    const limit = seoMonthlyArticleLimit(plan)
    if (isRegeneration && limit >= 0 && used >= limit) throw new SeoArticleQuotaError(limit, false, plan)
    const result = await action(tx)
    if (isRegeneration) {
      await tx.systemSetting.upsert({ where: { key }, create: { key, value: String(used + 1) }, update: { value: String(used + 1) } })
    }
    return result
  }, { timeout: 15000 })
}
