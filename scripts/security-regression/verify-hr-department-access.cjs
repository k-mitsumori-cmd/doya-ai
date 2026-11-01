const departmentReadLoader = require('./load-typescript.cjs').load;
const departmentReadModules = {'@/lib/hr/department-hierarchy':departmentReadLoader('src/lib/hr/department-hierarchy.ts'),'@/lib/hr/department-pagination':departmentReadLoader('src/lib/hr/department-pagination.ts',{'node:crypto':require('node:crypto')})};
const operationModule = require('./load-typescript.cjs').load('src/lib/hr/department-operation.ts', {'node:crypto': require('node:crypto')});
const privateApiResponse = require('./load-typescript.cjs').load('src/lib/private-api-response.ts', { 'next/server': { NextResponse: Response } });
const assert = require('node:assert/strict')
const { load, check, results } = require('./load-typescript.cjs')

const forbiddenDb = new Proxy({}, { get: (_, key) => { throw Error(`DB accessed before role check: ${String(key)}`) } })
const mocks = {
  ...departmentReadModules,
  '@/lib/hr/department-operation': operationModule, '@/lib/hr/department-input': load('src/lib/hr/department-input.ts'),
  '@/lib/hr/department-mutation': load('src/lib/hr/department-mutation.ts', { '@/lib/prisma': { prisma: forbiddenDb } }),
  '@/lib/private-api-response': privateApiResponse,
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
