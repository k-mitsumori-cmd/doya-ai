import { createHash } from 'node:crypto'
import type { Prisma, PrismaClient, SeoArticle } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { jstMonthRange, seoMonthlyArticleLimit, type SeoPlanCode } from '@/lib/seoAccess'

export class SeoArticleQuotaError extends Error {
  constructor(readonly limit: number, readonly guest: boolean) {
    super('SEO article quota reached')
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

type CreateArgs = {
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
  if (!userId) throw new SeoArticleQuotaError(0, true)

  return db.$transaction(async (tx) => {
    // The lock covers both creation routes. Count-after-lock sees the previous request's commit.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'seo-article:' + userId}))`
    const now = new Date()
    const key = seoArticleUsageKey(userId, now)
    const used = await getSeoArticleMonthlyUsage(tx, userId, now)
    const limit = seoMonthlyArticleLimit(plan)
    if (limit >= 0 && used >= limit) throw new SeoArticleQuotaError(limit, false)
    // Use the same post-lock time for admission and creation, including at a JST month boundary.
    const article = await tx.seoArticle.create({ data: { ...articleData, userId, guestId: null, createdAt: now } })
    const job = createJob ? await tx.seoJob.create({ data: { articleId: article.id, status: 'queued', step: 'init', progress: 0 } }) : null
    if (afterCreate) await afterCreate(tx, article)
    await tx.systemSetting.upsert({ where: { key }, create: { key, value: String(used + 1) }, update: { value: String(used + 1) } })
    return { article, job }
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
    if (isRegeneration && limit >= 0 && used >= limit) throw new SeoArticleQuotaError(limit, false)
    const result = await action(tx)
    if (isRegeneration) {
      await tx.systemSetting.upsert({ where: { key }, create: { key, value: String(used + 1) }, update: { value: String(used + 1) } })
    }
    return result
  }, { timeout: 15000 })
}
