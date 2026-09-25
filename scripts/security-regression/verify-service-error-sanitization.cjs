const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { load, check } = require('./load-typescript.cjs')
const root = path.resolve(__dirname, '../../src/app/api')
const secret = 'postgres://private-password@example.invalid/service'
const failure = () => { throw Error(secret) }
const server = { NextResponse: Response }
async function safe(promise, status, message) {
  const response = await promise
  assert.equal(response.status, status)
  const body = await response.json()
  assert.equal(body.error, message)
  assert(!JSON.stringify(body).includes(secret))
}
;(async () => {
  await check('Interview article retrieval never returns private database error', async () => {
    const api = load('src/app/api/interview/articles/[id]/route.ts', {
      'next/server': server,
      '@/lib/prisma': { prisma: { interviewDraft: { findUnique: failure } } },
      '@/lib/interview/access': {
        requireDatabase: () => null,
        getInterviewUser: async () => ({ userId: 'owner' }),
        getGuestIdFromRequest: () => null,
        checkOwnership: () => null,
      },
    })
    await safe(api.GET({}, { params: Promise.resolve({ id: 'article' }) }), 500, '取得に失敗しました')
  })
  await check('Promane workspace listing keeps 401 and hides database errors', async () => {
    const mocks = {
      'next/server': server,
      'next-auth': { getServerSession: async () => ({ user: { id: 'owner' } }) },
      '@/lib/auth': { authOptions: {} },
      '@/lib/prisma': { prisma: { promaneMember: { findMany: failure } } },
    }
    const api = load('src/app/api/promane/workspaces/route.ts', mocks)
    await safe(api.GET(), 500, 'ワークスペース取得に失敗しました')
    mocks['next-auth'].getServerSession = async () => null
    assert.equal((await api.GET()).status, 401)
  })
  await check('Mensetsu recording URL provider failure is a safe 502', async () => {
    const api = load('src/app/api/mensetsu/live/[token]/recording/route.ts', {
      'next/server': server,
      '@/lib/prisma': { prisma: {} },
      '@/lib/mensetsu/public': { loadSessionByToken: async () => ({ id: 'session', consentedAt: new Date(), organization: { recordAudio: true } }), assertUsable: () => ({ ok: true }) },
      '@/lib/mensetsu/storage': { createSignedUploadUrl: failure, recordingExists: async () => false },
    })
    await safe(api.POST({}, { params: Promise.resolve({ token: 't' }) }), 502, 'URLの発行に失敗しました')
  })
  await check('Interview, Promane, Mensetsu and DoyaSlide 5xx responses do not echo exceptions', async () => {
    let handlers = 0
    for (const service of ['interview', 'promane', 'mensetsu', 'doyaslide']) {
      function visit(dir) { for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
        const file = path.join(dir, item.name)
        if (item.isDirectory()) visit(file)
        else if (file.endsWith('.ts')) {
          const lines = fs.readFileSync(file, 'utf8').split('\n')
          for (let i = 0; i < lines.length; i++) {
            if (!/error:\s*(?:e|err|error)\??\.(?:message|stack)/.test(lines[i])) continue
            assert(!/status:\s*5\d\d/.test(lines.slice(i, i + 5).join(' ')), `${file}:${i + 1} echoes an internal exception`)
          }
          handlers += (fs.readFileSync(file, 'utf8').match(/status:\s*5\d\d/g) || []).length
        }
      } }
      visit(path.join(root, service))
    }
    assert(handlers >= 25)
  })
})().catch(error => { console.error(error); process.exitCode = 1 })
