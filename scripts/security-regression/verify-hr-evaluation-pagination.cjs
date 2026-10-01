const assert = require('node:assert/strict')
const { load, check } = require('./load-typescript.cjs')

let reads = 0
const rows = Array.from({ length: 221 }, (_, index) => ({ id: `evaluation-${String(220 - index).padStart(3, '0')}` }))
const api = load('src/app/api/hr/evaluations/route.ts', {
  'next/server': { NextResponse: Response },
  'next-auth': {},
  '@/lib/auth': {},
  '@/lib/prisma': { prisma: {
    hrEvaluation: {
      findMany: async (query) => {
        reads++
        assert.equal(query.where.period.is.organizationId, 'org')
        assert.equal(JSON.stringify(query.orderBy), JSON.stringify([{ createdAt: 'desc' }, { id: 'desc' }]))
        assert(query.take <= 100)
        return rows.slice(query.skip, query.skip + query.take)
      },
      count: async () => rows.length,
    },
  } },
  '@/lib/hr/access': { getHrContext: async () => ({ organizationId: 'org' }) },
  '@/lib/hr/evaluation-access': { getEvaluationReader: async () => ({ employeeId: null }) },
  '@/lib/hr/constants': { DEFAULT_PAGE_SIZE: 20, MAX_PAGE_SIZE: 100 },
})

;(async () => {
  await check('HR evaluations can page through all records in stable order', async () => {
    const ids = []
    for (let page = 1; page <= 3; page++) {
      const response = await api.GET({ nextUrl: new URL(`http://offline.invalid/?page=${page}&pageSize=100`) })
      assert.equal(response.status, 200)
      const result = await response.json()
      assert.equal(result.totalPages, 3)
      ids.push(...result.items.map((item) => item.id))
    }
    assert.deepEqual(ids, rows.map((row) => row.id))
  })
  for (const query of ['page=abc', 'page=1.5', 'page=-1', 'page=0', 'page=1000001',
    'pageSize=abc', 'pageSize=0', 'pageSize=1.5', 'pageSize=-1']) {
    await check(`HR evaluations reject ${query} before DB reads`, async () => {
      const before = reads
      const response = await api.GET({ nextUrl: new URL(`http://offline.invalid/?${query}`) })
      assert.equal(response.status, 400)
      assert.equal(reads, before)
    })
  }
})().catch((error) => { console.error(error); process.exitCode = 1 })
