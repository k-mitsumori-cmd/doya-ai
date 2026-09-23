import { createHash } from 'node:crypto'
import type { Prisma, PrismaClient, SeoArticle } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { jstMonthRange, seoMonthlyArticleLimit, type SeoPlanCode } from '@/lib/seoAccess'

export class SeoArticleQuotaError extends Error {
  constructor(readonly limit: number, readonly guest: boolean) {
    super('SEO article quota reached')
  }
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

type CreateArgs = {
  userId: string | null
  guestId: string | null
  plan: SeoPlanCode
  trialActive: boolean
  articleData: Omit<Prisma.SeoArticleUncheckedCreateInput, 'userId' | 'guestId'>
  createJob: boolean
  afterCreate?: (tx: Prisma.TransactionClient, article: SeoArticle) => Promise<void>
}

/** Both SEO creation routes share this serialized monthly admission and atomic article/job save. */
export async function createSeoArticleWithinLimit(args: CreateArgs, db: PrismaClient = prisma) {
  const { userId, guestId, plan, trialActive, articleData, createJob, afterCreate } = args
  if (!userId) throw new SeoArticleQuotaError(0, true)

  return db.$transaction(async (tx) => {
    // The lock covers both creation routes. Count-after-lock sees the previous request's commit.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'seo-article:' + userId}))`
    const now = new Date()
    const key = seoArticleUsageKey(userId, now)
    const used = await getSeoArticleMonthlyUsage(tx, userId, now)
    if (!trialActive) {
      const limit = seoMonthlyArticleLimit(plan)
      if (limit >= 0 && used >= limit) throw new SeoArticleQuotaError(limit, false)
    }
    // Use the same post-lock time for admission and creation, including at a JST month boundary.
    const article = await tx.seoArticle.create({ data: { ...articleData, userId, guestId: null, createdAt: now } })
    const job = createJob ? await tx.seoJob.create({ data: { articleId: article.id, status: 'queued', step: 'init', progress: 0 } }) : null
    if (afterCreate) await afterCreate(tx, article)
    await tx.systemSetting.upsert({ where: { key }, create: { key, value: String(used + 1) }, update: { value: String(used + 1) } })
    return { article, job }
  }, { timeout: 15000 })
}
