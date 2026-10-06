const assert = require('node:assert/strict')
const { load, check, results } = require('./load-typescript.cjs')

function fixture({ active = true, conflict = false } = {}) {
  let memberActive = active
  let attempts = 0
  let writes = 0
  const prisma = {
    $transaction: async (callback, options) => {
      attempts++
      assert.equal(options.isolationLevel, 'Serializable')
      if (conflict && attempts === 1) {
        memberActive = false
        throw Object.assign(new Error('serialization conflict'), { code: 'P2034' })
      }
      return callback({
        quoteMember: { findFirst: async ({ where }) => {
          assert.equal(where.organizationId, 'o')
          assert.equal(where.userId, 'u')
          assert.equal(where.status, 'ACTIVE')
          assert.deepEqual(Array.from(where.role.in), ['owner', 'admin'])
          return memberActive ? { id: 'm' } : null
        } },
        quoteIssuer: { upsert: async ({ where, create, update }) => {
          assert.equal(where.organizationId, 'o')
          assert.equal(create.organizationId, 'o')
          assert.equal(update.companyName, '会社名')
          writes++
          return { organizationId: 'o', ...update }
        } },
      })
    },
  }
  const route = load('src/app/api/quote/issuer/route.ts', {
    'next/server': { NextResponse: Response },
    '@/lib/quote/issuer-input': load('src/lib/quote/issuer-input.ts'),
    '@/lib/prisma': { prisma },
    '@/lib/quote/access': {
      getQuoteContext: async () => ({ userId: 'u', organizationId: 'o', role: 'admin' }),
      hasMinRole: role => ['owner', 'admin'].includes(role),
      orgSlugFrom: () => 'org',
    },
  })
  return {
    run: async body => {
      const response = await route.PUT({ json: async () => body })
      return { status: response.status, body: await response.json() }
    },
    state: () => ({ attempts, writes }),
  }
}

;(async () => {
  await check('issuer save rechecks current administrator inside the transaction', async () => {
    const f = fixture()
    const result = await f.run({ companyName: ' 会社名 ', address: '住所' })
    assert.equal(result.status, 200)
    assert.equal(result.body.issuer.companyName, '会社名')
    assert.deepEqual(f.state(), { attempts: 1, writes: 1 })
  })
  await check('revoked administrator cannot change the issuer', async () => {
    const f = fixture({ active: false })
    assert.equal((await f.run({ companyName: '会社名' })).status, 403)
    assert.deepEqual(f.state(), { attempts: 1, writes: 0 })
  })
  await check('administrator revoked after serialization conflict cannot retry a write', async () => {
    const f = fixture({ conflict: true })
    assert.equal((await f.run({ companyName: '会社名' })).status, 403)
    assert.deepEqual(f.state(), { attempts: 2, writes: 0 })
  })
  await check('non-string legal document fields are rejected before database access', async () => {
    for (const body of [
      { companyName: { label: '会社名' } },
      { companyName: 123 },
      { companyName: '会社名', invoiceNo: { value: 'T123' } },
      { companyName: '会社名', address: ['住所'] },
    ]) {
      const f = fixture()
      assert.equal((await f.run(body)).status, 400)
      assert.deepEqual(f.state(), { attempts: 0, writes: 0 })
    }
  })
  console.log(JSON.stringify({ passed: results.length, results }, null, 2))
})().catch(error => { console.error(error); process.exitCode = 1 })
