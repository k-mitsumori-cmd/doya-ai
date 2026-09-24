const assert = require('node:assert/strict')
const { load, check, results } = require('./load-typescript.cjs')

const context = { organizationId: 'o', userId: 'u', role: 'MEMBER' }
const forbiddenDb = new Proxy({}, { get: (_, key) => { throw Error(`DB accessed before role check: ${String(key)}`) } })
const common = {
  'next/server': { NextResponse: Response },
  'next-auth': { getServerSession: async () => ({ user: { id: 'u' } }) },
  '@/lib/auth': {},
  '@/lib/prisma': { prisma: forbiddenDb },
  '@/lib/hr/access': { getHrContext: async () => context, hasMinRole: role => role === 'ADMIN' || role === 'OWNER' },
  '@/lib/hr/types': { HrMemberRole: { ADMIN: 'ADMIN' } },
}

;(async () => {
  await check('non-admin cannot create, edit, remove or set photos before any DB write', async () => {
    const collection = load('src/app/api/hr/employees/route.ts', {
      ...common,
      '@/lib/hr/constants': { DEFAULT_PAGE_SIZE: 20, MAX_PAGE_SIZE: 100 },
      '@/lib/hr/billing': { createWithinEmployeeLimit: async () => { throw Error('quota reached before role') } },
      '@/lib/service-usage': { recordServiceUsage: async () => {} },
    })
    const item = load('src/app/api/hr/employees/[id]/route.ts', {
      ...common,
      '@/lib/hr/billing': {},
      '@/lib/hr/evaluation-access': {},
      '@/lib/hr/one-on-one-access': {},
    })
    const photo = load('src/app/api/hr/employees/[id]/photo/route.ts', common)
    const req = { json: async () => { throw Error('body read before role check') } }
    const params = { params: Promise.resolve({ id: 'e' }) }
    for (const response of [
      await collection.POST(req),
      await item.PATCH(req, params),
      await item.DELETE(req, params),
      await photo.POST(req, params),
    ]) assert.equal(response.status, 403)
  })

  await check('photo endpoint rejects invalid base64 and MIME, accepts a bounded PNG', async () => {
    let writes = 0
    const prisma = {
      hrEmployee: {
        findFirst: async ({ where }) => { assert.equal(where.organizationId, 'o'); return { id: 'e' } },
        update: async ({ data }) => { writes++; return data },
      },
    }
    const photo = load('src/app/api/hr/employees/[id]/photo/route.ts', {
      ...common,
      '@/lib/prisma': { prisma },
      '@/lib/hr/access': { getHrContext: async () => ({ ...context, role: 'ADMIN' }), hasMinRole: () => true },
    })
    const params = { params: Promise.resolve({ id: 'e' }) }
    const validPng = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]).toString('base64')
    for (const body of [
      { photoBase64: validPng, mimeType: 'text/html' },
      { photoBase64: '%%%invalid', mimeType: 'image/png' },
      { photoBase64: Buffer.alloc(1024 * 1024 + 1).toString('base64'), mimeType: 'image/png' },
    ]) {
      const response = await photo.POST({ json: async () => body }, params)
      assert.equal(response.status, 400)
    }
    assert.equal(writes, 0)
    const response = await photo.POST({ json: async () => ({ photoBase64: validPng, mimeType: 'image/png' }) }, params)
    assert.equal(response.status, 200)
    assert.equal(writes, 1)
  })

  console.log(JSON.stringify({ passed: results.length, results }, null, 2))
})().catch(error => { console.error(error); process.exitCode = 1 })
