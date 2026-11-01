const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')

const operationalJson = load('src/lib/operational-json.ts', {}, { TextDecoder, Uint8Array })
const projectInput = load('src/lib/doyalist/project-input.ts')
const streamJson = load('src/lib/doyalist/stream-json.ts', {}, { TextEncoder, ReadableStream, Uint8Array })
const writes = []
const prisma = {
  doyalistProject: {
    create: async ({ data }) => { writes.push({ kind: 'create', data }); return { id: 'p', ...data } },
    findUnique: async () => ({ id: 'p', userId: 'owner' }),
    update: async ({ data }) => { writes.push({ kind: 'update', data }); return { id: 'p', ...data } },
  },
}
const mocks = {
  'next/server': { NextResponse: Response },
  'next-auth': { getServerSession: async () => ({ user: { id: 'owner' } }) },
  '@/lib/auth': { authOptions: {} },
  '@/lib/prisma': { prisma },
  '@/lib/doyalist/limits': { getUserDoyalistLimits: async () => ({ maxProjects: -1 }) },
  '@/lib/operational-json': operationalJson,
  '@/lib/doyalist/project-input': projectInput,
  '@/lib/doyalist/stream-json': streamJson,
  '@/lib/plan-limit': { jstStartOfMonthUtc: () => new Date('2026-10-01T00:00:00Z') },
  '@/lib/doyalist/export-stream': {},
}
const create = load('src/app/api/doyalist/projects/route.ts', mocks)
const detail = load('src/app/api/doyalist/projects/[id]/route.ts', mocks)
const ctx = { params: Promise.resolve({ id: 'p' }) }
const req = (value, method = 'POST') => new Request('https://doya.test/api/doyalist/projects', {
  method, body: JSON.stringify(value),
})

;(async () => {
  for (const body of [null, [], {}, { name: {} }, { name: ' ' }, { name: 'x'.repeat(201) },
    { name: 'Valid', description: {} }, { name: 'Valid', industry: 7 },
    { name: 'Valid', keywords: 'x'.repeat(3001) }]) {
    const response = await create.POST(req(body))
    assert.equal(response.status, 400, JSON.stringify(body)?.slice(0, 100))
  }
  assert.equal((await create.POST(req({ name: 'Valid', padding: 'x'.repeat(33000) }))).status, 413)
  assert.equal(writes.length, 0, 'invalid create requests must not write')

  const created = await create.POST(req({ name: '  Valid  ', description: '', industry: 'IT', keywords: '営業' }))
  assert.equal(created.status, 409)
  assert.equal((await created.json()).code, 'OPERATION_REQUIRED')
  assert.equal(writes.length, 0, 'legacy valid create cannot bypass the durable operation')

  for (const body of [null, [], { name: '' }, { name: null }, { description: [] },
    { status: 'published' }, { status: null }, { targetSize: 'x'.repeat(101) }]) {
    const response = await detail.PATCH(req(body, 'PATCH'), ctx)
    assert.equal(response.status, 400, JSON.stringify(body)?.slice(0, 100))
  }
  assert.equal((await detail.PATCH(req({ name: 'Valid', padding: 'x'.repeat(33000) }, 'PATCH'), ctx)).status, 413)
  assert.equal(writes.length, 0, 'invalid update requests must not write')

  const updated = await detail.PATCH(req({ name: '  Updated  ', description: null, status: 'archived' }, 'PATCH'), ctx)
  assert.equal(updated.status, 200)
  assert.deepEqual(JSON.parse(JSON.stringify(writes[0].data)), { name: 'Updated', description: null, status: 'archived' })
  console.log('PASS Doyalist project create/update reject malformed and oversized input before writes')
})().catch((error) => { console.error(error); process.exitCode = 1 })
