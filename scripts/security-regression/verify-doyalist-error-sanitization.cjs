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
    '@/lib/plan-limit': { jstStartOfMonthUtc: () => new Date('2026-10-01T00:00:00Z') },
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
  await check('Doyalist project list keeps database errors private and legacy creation stops before writes', async () => {
    const api = route('src/app/api/doyalist/projects/route.ts', {
      doyalistProject: { findMany: failure, create: failure },
    })
    await expectSafe(api.GET(), 'プロジェクトの取得に失敗しました')
    const denied = await api.POST(request({ name: 'valid' }))
    assert.equal(denied.status, 409)
    assert.equal((await denied.json()).code, 'OPERATION_REQUIRED')
  })
  await check('Doyalist project list pages histories larger than the response limit', async () => {
    const projects = Array.from({ length: 5001 }, (_, index) => ({
      id: `project-${String(5000 - index).padStart(5, '0')}`,
      name: 'x'.repeat(1000), status: 'active',
      _count: { companies: index, approaches: 0 },
    }))
    let calls = 0
    const api = route('src/app/api/doyalist/projects/route.ts', {
      doyalistProject: { findMany: async (query) => {
        calls++
        assert.equal(query.where.userId, 'owner')
        assert.equal(query.where.status.not, 'archived')
        assert(query.take <= 200)
        assert.equal(JSON.stringify(query.orderBy), JSON.stringify([{ updatedAt: 'desc' }, { id: 'desc' }]))
        const offset = query.cursor ? projects.findIndex(project => project.id === query.cursor.id) + 1 : 0
        return projects.slice(offset, offset + query.take)
      } },
    })
    const response = await api.GET()
    assert.equal(response.status, 200)
    const body = await response.text()
    assert(Buffer.byteLength(body) > 4.5 * 1024 * 1024)
    const result = JSON.parse(body)
    assert.equal(result.projects.length, projects.length)
    assert.equal(result.projects.at(-1).id, projects.at(-1).id)
    assert.equal(result.projects[42].companyCount, 42)
    assert(calls > 20)
  })
  await check('Doyalist history pages and searches projects with global counts', async () => {
    const projects = Array.from({ length: 120 }, (_, index) => ({
      id: `project-${String(119 - index).padStart(3, '0')}`,
      name: index < 60 ? `Tokyo ${index}` : `Osaka ${index}`,
      _count: { companies: index, approaches: 0 },
    }))
    const api = route('src/app/api/doyalist/projects/route.ts', {
      doyalistProject: {
        findFirst: async ({ where }) => projects.find(project => project.id === where.id && (!where.OR || project.name.includes('Tokyo'))),
        findMany: async (query) => {
          assert(query.take <= 51)
          assert.equal(query.where.userId, 'owner')
          const rows = query.where.OR ? projects.filter(project => project.name.includes('Tokyo')) : projects
          const offset = query.cursor ? rows.findIndex(project => project.id === query.cursor.id) + 1 : 0
          return rows.slice(offset, offset + query.take)
        },
        count: async ({ where }) => where.createdAt ? 20 : where.OR ? 60 : 120,
      },
      doyalistCompany: { count: async ({ where }) => { assert.equal(where.project.userId, 'owner'); return 1000 } },
    })
    const req = (query) => ({ nextUrl: { searchParams: new URL(`https://doya.test/api/doyalist/projects?${query}`).searchParams } })
    const first = await api.GET(req('limit=50&search=Tokyo'))
    assert.equal(first.status, 200)
    const firstPage = await first.json()
    assert.equal(firstPage.projects.length, 50)
    assert.equal(firstPage.total, 60)
    assert.equal(firstPage.summary.allTotal, 120)
    assert.equal(firstPage.summary.thisMonth, 20)
    assert.equal(firstPage.summary.totalCompanies, 1000)
    assert.equal(firstPage.nextCursor, firstPage.projects[49].id)
    const second = await api.GET(req(`limit=50&search=Tokyo&cursor=${firstPage.nextCursor}`))
    const secondPage = await second.json()
    assert.equal(secondPage.projects.length, 10)
    assert.equal(secondPage.nextCursor, null)
    assert.equal((await api.GET(req('limit=51'))).status, 400)
    assert.equal((await api.GET(req('limit=50&cursor=foreign'))).status, 400)
  })
  await check('Doyalist project list aborts an incomplete stream on a later DB failure', async () => {
    const api = route('src/app/api/doyalist/projects/route.ts', {
      doyalistProject: { findMany: async (query) => {
        if (query.cursor) throw Error(secret)
        return Array.from({ length: 200 }, (_, index) => ({
          id: `project-${index}`, _count: { companies: 0, approaches: 0 },
        }))
      } },
    })
    const response = await api.GET()
    assert.equal(response.status, 200)
    await assert.rejects(response.text())
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
