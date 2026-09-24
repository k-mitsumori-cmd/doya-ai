const assert = require('node:assert/strict')
const { load, check, results } = require('./load-typescript.cjs')

const forbiddenDb = new Proxy({}, { get: (_, key) => { throw Error(`DB accessed before role check: ${String(key)}`) } })
const mocks = {
  'next/server': { NextResponse: Response },
  'next-auth': { getServerSession: async () => ({ user: { id: 'u' } }) },
  '@/lib/auth': {},
  '@/lib/prisma': { prisma: forbiddenDb },
  '@/lib/hr/access': {
    getHrContext: async () => ({ organizationId: 'o', userId: 'u', role: 'MEMBER' }),
    hasMinRole: role => role === 'ADMIN' || role === 'OWNER',
  },
  '@/lib/department-integrity': { validDepartmentParent: async () => true },
}

;(async () => {
  await check('HR member cannot create, edit or delete departments before DB and body reads', async () => {
    const collection = load('src/app/api/hr/departments/route.ts', mocks)
    const item = load('src/app/api/hr/departments/[id]/route.ts', mocks)
    const req = { json: async () => { throw Error('body read before role check') } }
    const ctx = { params: Promise.resolve({ id: 'd' }) }
    for (const response of [await collection.POST(req), await item.PATCH(req, ctx), await item.DELETE(req, ctx)]) {
      assert.equal(response.status, 403)
    }
  })
  console.log(JSON.stringify({ passed: results.length, results }))
})().catch(error => { console.error(error); process.exitCode = 1 })
