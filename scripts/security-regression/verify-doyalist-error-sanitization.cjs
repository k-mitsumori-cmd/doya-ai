const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { load, check } = require('./load-typescript.cjs')
const root = path.resolve(__dirname, '../../src/app/api/doyalist')
const secret = 'DATABASE_URL=private-and-sensitive'
const failure = () => { throw Error(secret) }
const identity = { user: { id: 'owner' } }

function route(file, prisma) {
  return load(file, {
    'next/server': { NextResponse: Response },
    'next-auth': { getServerSession: async () => identity },
    '@/lib/auth': { authOptions: {} },
    '@/lib/prisma': { prisma },
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
    await expectSafe(api.POST({ json: async () => ({ name: 'valid' }) }), 'プロジェクトの作成に失敗しました')
  })
  await check('Doyalist project detail, update and deletion keep database errors private', async () => {
    const prisma = { doyalistProject: {
      findUnique: async () => ({ id: 'p', userId: 'owner' }),
      findMany: failure, update: failure,
    }, doyalistCompany: { findMany: failure }, doyalistApproach: { findMany: failure, count: failure } }
    const api = route('src/app/api/doyalist/projects/[id]/route.ts', prisma)
    const context = { params: Promise.resolve({ id: 'p' }) }
    await expectSafe(api.GET({}, context), 'プロジェクトの取得に失敗しました')
    await expectSafe(api.PATCH({ json: async () => ({ name: 'updated' }) }, context), 'プロジェクトの更新に失敗しました')
    await expectSafe(api.DELETE({}, context), 'プロジェクトの削除に失敗しました')
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
    }
  })
})().catch(error => { console.error(error); process.exitCode = 1 })
