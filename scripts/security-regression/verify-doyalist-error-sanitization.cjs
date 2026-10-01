const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { load, check } = require('./load-typescript.cjs')
const root = path.resolve(__dirname, '../../src/app/api/doyalist')
const secret = 'DATABASE_URL=private-and-sensitive'
const failure = () => { throw Error(secret) }
const identity = { user: { id: 'owner' } }
const streamJson = load('src/lib/doyalist/stream-json.ts', {}, { TextEncoder, ReadableStream, Uint8Array })
const exportCsv = load('src/lib/doyalist/export-csv.ts')
const operationalJson = load('src/lib/operational-json.ts', {}, { TextDecoder, Uint8Array })
const projectInput = load('src/lib/doyalist/project-input.ts')
const request = (body) => new Request('https://doya.test/api/doyalist/projects', { method: 'POST', body: JSON.stringify(body) })

function route(file, prisma) {
  const exportStream = load('src/lib/doyalist/export-stream.ts', {
    '@/lib/prisma': { prisma }, '@/lib/doyalist/export-csv': exportCsv,
  })
  return load(file, {
    'next/server': { NextResponse: Response },
    'next-auth': { getServerSession: async () => identity },
    '@/lib/auth': { authOptions: {} },
    '@/lib/prisma': { prisma },
    '@/lib/doyalist/stream-json': streamJson,
    '@/lib/doyalist/export-stream': exportStream,
    '@/lib/operational-json': operationalJson,
    '@/lib/doyalist/project-input': projectInput,
    '@/lib/doyalist/limits': { getUserDoyalistLimits: async () => ({ maxProjects: -1 }) },
  })
}
async function expectSafe(promise, expected) {
  const response = await promise
  assert.equal(response.status, 500)
  const data = await response.json()
  assert.equal(data.error, expected)
  assert(!JSON.stringify(data).includes(secret))
}
;(async () => {
  await check('Doyalist project list and creation keep database errors private', async () => {
    const api = route('src/app/api/doyalist/projects/route.ts', {
      doyalistProject: { findMany: failure, create: failure },
    })
    await expectSafe(api.GET(), 'プロジェクトの取得に失敗しました')
    await expectSafe(api.POST(request({ name: 'valid' })), 'プロジェクトの作成に失敗しました')
  })
  await check('Doyalist project detail, update and deletion keep database errors private', async () => {
    const prisma = { doyalistProject: {
      findUnique: async () => ({ id: 'p', userId: 'owner' }),
      findMany: failure, update: failure,
    }, doyalistCompany: { findMany: failure, groupBy: failure }, doyalistApproach: { findMany: failure, count: failure } }
    const api = route('src/app/api/doyalist/projects/[id]/route.ts', prisma)
    const context = { params: Promise.resolve({ id: 'p' }) }
    await expectSafe(api.GET({}, context), 'プロジェクトの取得に失敗しました')
    await expectSafe(api.PATCH(request({ name: 'updated' }), context), 'プロジェクトの更新に失敗しました')
    await expectSafe(api.DELETE({}, context), 'プロジェクトの削除に失敗しました')
  })
  await check('Doyalist project detail streams owned company records and keeps counts', async () => {
    const api = route('src/app/api/doyalist/projects/[id]/route.ts', {
      doyalistProject: { findUnique: async () => ({ id: 'p', userId: 'owner' }) },
      doyalistCompany: {
        findMany: async () => [{ id: 'one', status: 'new' }, { id: 'two', status: 'won' }],
        groupBy: async () => [{ status: 'new', _count: { _all: 1 } }, { status: 'won', _count: { _all: 1 } }],
      },
      doyalistApproach: { findMany: async () => [], count: async () => 0 },
    })
    const response = await api.GET({}, { params: Promise.resolve({ id: 'p' }) })
    assert.equal(response.status, 200)
    const data = await response.json()
    assert.deepEqual(data.companies.map((company) => company.id), ['one', 'two'])
    assert.equal(data.summary.companyCount, 2)
    assert.equal(data.summary.statusCounts.won, 1)
  })
  await check('Doyalist detail pages large company history without loading all rows', async () => {
    const companies = Array.from({ length: 5001 }, (_, index) => ({
      id: `company-${index}`, status: 'new', description: 'x'.repeat(1000),
    }))
    let pageCalls = 0
    const api = route('src/app/api/doyalist/projects/[id]/route.ts', {
      doyalistProject: { findUnique: async () => ({ id: 'p', userId: 'owner' }) },
      doyalistCompany: {
        findMany: async (query) => {
          pageCalls++
          assert.equal(query.where.projectId, 'p')
          assert(query.take <= 200)
          const offset = query.cursor ? companies.findIndex(company => company.id === query.cursor.id) + 1 : 0
          return companies.slice(offset, offset + query.take)
        },
        groupBy: async () => [{ status: 'new', _count: { _all: companies.length } }],
      },
      doyalistApproach: { findMany: async () => [], count: async () => 0 },
    })
    const response = await api.GET({}, { params: Promise.resolve({ id: 'p' }) })
    assert.equal(response.status, 200)
    const text = await response.text()
    assert(Buffer.byteLength(text) > 4.5 * 1024 * 1024)
    const result = JSON.parse(text)
    assert.equal(result.companies.length, companies.length)
    assert.equal(result.companies.at(-1).id, 'company-5000')
    assert.equal(result.summary.companyCount, companies.length)
    assert(pageCalls > 20)
  })
  await check('Doyalist detail aborts an incomplete streamed result on later database failure', async () => {
    const api = route('src/app/api/doyalist/projects/[id]/route.ts', {
      doyalistProject: { findUnique: async () => ({ id: 'p', userId: 'owner' }) },
      doyalistCompany: {
        findMany: async (query) => {
          if (query.cursor) throw Error(secret)
          return Array.from({ length: 200 }, (_, index) => ({ id: `company-${index}`, status: 'new' }))
        },
        groupBy: async () => [{ status: 'new', _count: { _all: 201 } }],
      },
      doyalistApproach: { findMany: async () => [], count: async () => 0 },
    })
    const response = await api.GET({}, { params: Promise.resolve({ id: 'p' }) })
    assert.equal(response.status, 200)
    await assert.rejects(response.text())
  })
  await check('Doyalist API 5xx handlers never interpolate internal error messages', async () => {
    const files = []
    function visit(dir) { for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, item.name)
      if (item.isDirectory()) visit(file)
      else if (file.endsWith('.ts')) files.push(file)
    } }
    visit(root)
    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8')
      assert(!/error:\s*(?:e|err|error)\??\.(?:message|stack)/.test(source), `${file} exposes an internal error`)
      assert(!/console\.(?:error|warn)\([^\n]*,\s*(?:e|err|error)\b/.test(source), `${file} logs an internal error object`)
    }
    const limits = fs.readFileSync('src/lib/doyalist/limits.ts', 'utf8')
    assert(!/console\.(?:error|warn)\([^\n]*,\s*(?:e|err|error)\b/.test(limits), 'quota refund logs an internal error object')
  })
})().catch(error => { console.error(error); process.exitCode = 1 })
