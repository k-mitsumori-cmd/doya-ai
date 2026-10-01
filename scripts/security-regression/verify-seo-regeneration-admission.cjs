const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')

const { runSeoArticleRegenerationWithinLimit, SeoArticleQuotaError, SeoArticleNotFoundError } = load('src/lib/seo-article-admission.ts', {
  'node:crypto': require('node:crypto'),
  '@/lib/prisma': { prisma: {} },
  '@/lib/seoAccess': {
    jstMonthRange: now => ({ start: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) - 9 * 3600000), end: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1) - 9 * 3600000) }),
    seoMonthlyArticleLimit: plan => plan === 'FREE' ? 3 : 30,
  },
})

let jobs = 0
let savedArticles = 1
const ledger = new Map()
let lock = Promise.resolve()
const db = {
  $transaction: async action => {
    let release
    const previous = lock
    lock = new Promise(resolve => { release = resolve })
    await previous
    let pendingJobs = 0
    let pendingLedger = null
    const tx = {
      $executeRaw: async () => 1,
      seoArticle: {
        findFirst: async ({ where }) => where.id === 'article' && where.userId === 'owner' ? { id: 'article' } : null,
        count: async () => savedArticles,
      },
      seoJob: { count: async () => jobs, create: async () => { pendingJobs++; return { id: `job-${jobs + pendingJobs}` } } },
      systemSetting: {
        findUnique: async ({ where }) => ledger.has(where.key) ? { value: ledger.get(where.key) } : null,
        upsert: async ({ where, create, update }) => { pendingLedger = [where.key, ledger.has(where.key) ? update.value : create.value] },
      },
    }
    try {
      const result = await action(tx)
      jobs += pendingJobs
      if (pendingLedger) ledger.set(...pendingLedger)
      return result
    } finally { release() }
  },
}
const start = (overrides = {}) => runSeoArticleRegenerationWithinLimit({
  userId: 'owner', articleId: 'article', plan: 'FREE',
  action: tx => tx.seoJob.create({ data: { articleId: 'article' } }), ...overrides,
}, db)

;(async () => {
  await assert.rejects(start({ userId: 'foreign' }), SeoArticleNotFoundError)
  assert.equal(jobs, 0)

  await start()
  assert.equal(jobs, 1, 'first generation of a saved draft is included in article creation')
  assert.equal(ledger.size, 0)

  await assert.rejects(start({ action: async tx => { await tx.seoJob.create({}); throw new Error('job save failed') } }), /job save failed/)
  assert.equal(jobs, 1, 'failed regeneration rolls back its job')
  assert.equal(ledger.size, 0, 'failed regeneration does not use the monthly quota')

  const attempts = await Promise.allSettled([start(), start(), start()])
  assert.equal(attempts.filter(result => result.status === 'fulfilled').length, 2)
  assert.equal(attempts.filter(result => result.reason instanceof SeoArticleQuotaError).length, 1)
  assert.equal(jobs, 3, 'concurrent regeneration cannot exceed the monthly quota')
  assert.equal(Number([...ledger.values()][0]), 3)

  savedArticles = 0
  await assert.rejects(start(), SeoArticleQuotaError)
  assert.equal(jobs, 3, 'deleting another article cannot restore regeneration quota')
  console.log('PASS SEO regeneration: first draft job included, owner checked, failure rolled back, concurrent monthly cap, deletion-resistant ledger')
})().catch(error => { console.error(error); process.exitCode = 1 })
