const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')

function fixture(active) {
  const calls = []
  let writes = 0
  const scan = { id: 'scan', organizationId: 'org', status: 'done', updatedAt: new Date() }
  const tx = {
    $queryRaw: async sql => {
      const query = sql.join('?')
      calls.push(query)
      if (query.includes('FROM aio_members')) {
        assert.match(query, /status = 'ACTIVE'.*role IN \('owner', 'admin'\) FOR UPDATE/s)
        return active ? [{ id: 'actor' }] : []
      }
      return [{ id: query.includes('aio_scans') ? 'scan' : 'org' }]
    },
    aioScan: {
      findFirst: async ({ where }) => {
        assert.equal(where.organizationId, 'org')
        return scan
      },
      update: async () => { writes++; return scan },
    },
    aioResult: { deleteMany: async () => { writes++; return { count: 1 } } },
  }
  const route = load('src/app/api/aio/scans/[id]/route.ts', {
    'next/server': { NextResponse: Response },
    '@prisma/client': { Prisma: { DbNull: null } },
    '@/lib/prisma': { prisma: { $transaction: fn => fn(tx) } },
    '@/lib/aio/access': {
      getAioContext: async () => ({ userId: 'user', memberId: 'actor', organizationId: 'org', role: 'admin' }),
      hasMinRole: () => true,
      orgSlugFrom: () => undefined,
    },
    '@/lib/aio/types': { effectiveScanStatus: status => status },
  })
  return { call: () => route.DELETE({}, { params: Promise.resolve({ id: 'scan' }) }), state: () => ({ calls, writes }) }
}

;(async () => {
  const revoked = fixture(false)
  assert.equal((await revoked.call()).status, 403)
  assert.equal(revoked.state().writes, 0)
  assert.equal(revoked.state().calls.length, 2)

  const active = fixture(true)
  assert.equal((await active.call()).status, 200)
  assert.equal(active.state().writes, 2)
  assert.equal(active.state().calls.length, 3)
  console.log('PASS AIO scan deletion locks and rechecks current admin membership before deleting content')
})().catch(error => { console.error(error); process.exitCode = 1 })
