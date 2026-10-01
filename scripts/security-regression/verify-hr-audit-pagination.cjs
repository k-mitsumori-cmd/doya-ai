const assert = require('node:assert/strict')
const fs = require('node:fs')
const { load, check } = require('./load-typescript.cjs')

let reads = 0
const api = load('src/app/api/hr/audit-logs/route.ts', {
  'next/server': { NextResponse: Response },
  '@/lib/prisma': { prisma: { hrAuditLog: {
    findMany: async (query) => {
      reads++
      assert.equal(query.where.organizationId, 'organization-1')
      assert.equal(JSON.stringify(query.orderBy), JSON.stringify([{ createdAt: 'desc' }, { id: 'desc' }]))
      return []
    },
    count: async ({ where }) => {
      assert.equal(where.organizationId, 'organization-1')
      return 0
    },
  } } },
  '@/lib/hr/access': { getHrContext: async () => ({ role: 'ADMIN', organizationId: 'organization-1' }), hasMinRole: () => true },
  '@/lib/hr/types': { HrMemberRole: { ADMIN: 'ADMIN' } },
  '@/lib/hr/constants': { DEFAULT_PAGE_SIZE: 20, MAX_PAGE_SIZE: 100 },
})
const req = (query) => ({ nextUrl: new URL(`https://doya.test/api/hr/audit-logs?${query}`) })

;(async () => {
  await check('HR audit log uses bounded defaults and stable order', async () => {
    const response = await api.GET(req(''))
    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.page, 1)
    assert.equal(body.pageSize, 20)
    assert.equal(reads, 1)
  })
  for (const query of ['page=abc', 'page=0', 'page=1.5', 'page=10001', 'page=', 'pageSize=abc', 'pageSize=0', 'pageSize=1.5', 'pageSize=101', 'pageSize=']) {
    await check(`HR audit log rejects invalid ${query} before DB read`, async () => {
      const before = reads
      const response = await api.GET(req(query))
      assert.equal(response.status, 400)
      assert.equal(reads, before)
    })
  }
  await check('HR audit log does not log raw exceptions', async () => {
    const source = fs.readFileSync('src/app/api/hr/audit-logs/route.ts', 'utf8')
    assert(!/console\.(?:error|warn)\([^\n]*,\s*(?:e|err|error)\b/.test(source))
  })
})().catch((error) => { console.error(error); process.exitCode = 1 })
