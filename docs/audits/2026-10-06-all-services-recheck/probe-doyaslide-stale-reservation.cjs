const assert = require('node:assert/strict'), fs = require('node:fs'), crypto = require('node:crypto')
const { load } = require('../../../scripts/security-regression/load-typescript.cjs')
;(async () => {
  let providerCalls = 0, updates = 0
  const now = new Date(), stale = new Date(now.getTime() - 30 * 60000)
  const sub = { monthlyUsage: 20, lastUsageReset: now }
  const slides = Array.from({ length: 20 }, (_, index) => ({ id: 'slide-' + index, index, status: 'generating', imageUrl: null, version: 1, visualPrompt: 'Synthetic' }))
  const prisma = {
    user: { findUnique: async () => ({ plan: 'FREE' }) },
    userServiceSubscription: { findUnique: async () => sub, update: async () => { updates++; throw Error('Unexpected write') } },
    doyaSlideProject: { findFirst: async () => ({ id: 'project', userId: 'actor', status: 'generating', updatedAt: stale, slides }) },
    $queryRaw: async () => [{ id: 'actor' }], $transaction: async fn => fn(prisma)
  }
  const limits = load('src/lib/doyaslide/limits.ts', { '@/lib/prisma': { prisma }, '@/lib/plan-utils': load('src/lib/plan-utils.ts'), '@/lib/pricing': { SUPPORT_CONTACT_URL: 'https://local.test/contact' } })
  const route = load('src/app/api/doyaslide/generate/route.ts', {
    'next/server': { NextResponse: { json: (value, options) => Response.json(value, options) } }, '@/lib/prisma': { prisma }, '@/lib/doyaslide/access': { getUserId: async () => 'actor' }, '@/lib/service-usage': { recordServiceUsage: async () => { throw Error('Unexpected usage record') } }, '@/lib/doyaslide/limits': limits,
    '@/lib/doyaslide/generate': { composeSlideImage: async () => { providerCalls++; throw Error('Unexpected paid call') } }
  })
  const outcomes = []
  for (let i = 0; i < 2; i++) {
    const response = await route.POST(new Request('https://local.test/api/doyaslide/generate', { method: 'POST', body: JSON.stringify({ projectId: 'project', onlyPending: true }) }))
    const body = await response.json(); assert.equal(response.status, 403); assert.equal(body.code, 'LIMIT_REACHED'); outcomes.push({ status: response.status, code: body.code })
  }
  assert.equal(await limits.getMonthlyUsage('actor'), 20); assert.equal(providerCalls, 0); assert.equal(updates, 0)
  const staleSingleOutcomes = []
  for (const kind of ['regenerate', 'chat']) {
    const singlePrisma = { doyaSlideSlide: { findUnique: async () => ({ ...slides[0], updatedAt: stale, project: { id: 'project', userId: 'actor', status: 'completed', updatedAt: stale } }) } }
    const api = load(`src/app/api/doyaslide/slides/[id]/${kind}/route.ts`, {
      'next/server': { NextResponse: { json: (value, options) => Response.json(value, options) } }, '@/lib/prisma': { prisma: singlePrisma }, '@/lib/doyaslide/access': { getUserId: async () => 'actor' },
      '@/lib/doyaslide/project-lock': { withDoyaSlideProjectLock: async () => { throw Error('Unexpected write') } }, '@/lib/doyaslide/limits': { reserveMonthlySlides: async () => { throw Error('Unexpected quota admission') } },
      '@/lib/doyaslide/generate': { composeSlideImage: async () => { throw Error('Unexpected paid image call') } }, '@/lib/doyaslide/vision': { reviseSlidePrompt: async () => { throw Error('Unexpected paid text call') } }, '@/lib/doyaslide/logo': {}, '@/lib/fetch-timeout': {}
    })
    const response = await api.POST(new Request('https://local.test', { method: 'POST', body: JSON.stringify({ message: 'Synthetic change' }) }), { params: Promise.resolve({ id: 'slide-0' }) })
    const data = await response.json(); assert.equal(response.status, 409); assert.match(data.error, /生成中/); staleSingleOutcomes.push({ kind, status: response.status, message: data.error })
  }
  const files = ['src/app/api/doyaslide/generate/route.ts', 'src/lib/doyaslide/limits.ts', 'src/app/api/doyaslide/slides/[id]/regenerate/route.ts', 'src/app/api/doyaslide/slides/[id]/chat/route.ts']
  const evidence = { checkedAt: new Date().toISOString(), outcomes, staleSingleOutcomes, providerCalls, writes: updates, pendingProjectMinutes: 30, usage: 20, completedSlides: 0,
    finding: 'If a process terminates after reserving20 and before generating/refunding any slides, the stale project cannot recover: retry attempts quota admission first and returns LIMIT_REACHED forever this month. Reservation ownership/remaining amount are not durably recorded for reclamation.',
    additionalFinding: 'Single slide regenerate/chat routes reject generating status without any expiry check, even30minutes after termination and with project completed.', scope: 'Actual batch/single generation routes and actual quota helper/plan normalization with synthetic killed-process state. No real provider, customer DB, production mutation or actual process termination.', sourceHashes: Object.fromEntries(files.map(f => [f, crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')])) }
  fs.writeFileSync('docs/audits/2026-10-06-all-services-recheck/doyaslide-stale-reservation-baseline.json', JSON.stringify(evidence, null, 2) + '\n')
  console.log(JSON.stringify(evidence))
})().catch(error => { console.error(error); process.exitCode = 1 })
