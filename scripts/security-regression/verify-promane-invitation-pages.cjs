const assert = require('node:assert/strict')
const { load, check } = require('./load-typescript.cjs')

const invitations = Array.from({ length: 121 }, (_, index) => ({
  id: `invite-${String(121 - index).padStart(3, '0')}`,
  workspaceId: 'own-workspace',
  token: `token-${index}`,
  email: `person${index}@example.com`,
  role: 'member',
  acceptedAt: null,
  expiresAt: new Date('2026-10-25T00:00:00Z'),
  createdAt: new Date('2026-09-25T00:00:00Z'),
}))
invitations.push({ ...invitations[0], id: 'foreign-invite', workspaceId: 'foreign-workspace' })
let failCount = false
const prisma = {
  promaneMember: { findUnique: async ({ where }) =>
    where.workspaceId_userId.workspaceId === 'own-workspace' && where.workspaceId_userId.userId === 'owner'
      ? { role: 'owner' } : null },
  promaneInvitation: {
    findFirst: async ({ where }) => invitations.find((row) => row.workspaceId === where.workspaceId && row.id === where.id) || null,
    findMany: async ({ where, orderBy, take, cursor }) => {
      assert.equal(where.workspaceId, 'own-workspace')
      assert.equal(take, 51)
      assert.deepEqual(JSON.parse(JSON.stringify(orderBy)), [{ createdAt: 'desc' }, { id: 'desc' }])
      const owned = invitations.filter((row) => row.workspaceId === where.workspaceId)
      const start = cursor ? owned.findIndex((row) => row.id === cursor.id) + 1 : 0
      return owned.slice(start, start + take)
    },
    count: async ({ where }) => {
      if (failCount) throw new Error('private database details')
      return invitations.filter((row) => row.workspaceId === where.workspaceId).length
    },
  },
}
const route = load('src/app/api/promane/invitations/route.ts', {
  'next/server': { NextResponse: Response },
  'next-auth': { getServerSession: async () => ({ user: { id: 'owner', email: 'owner@example.com' } }) },
  '@/lib/auth': { authOptions: {} },
  '@/lib/prisma': { prisma },
})
const request = (query) => ({ nextUrl: new URL(`http://offline.invalid/api/promane/invitations?type=sent&workspaceId=own-workspace${query}`) })

;(async () => {
  await check('all 121 sent invitations remain reachable with owner-scoped cursors', async () => {
    const seen = []
    let cursor = null
    let pages = 0
    do {
      const response = await route.GET(request(cursor ? `&cursor=${cursor}` : ''))
      assert.equal(response.status, 200)
      assert.equal(response.headers.get('cache-control'), 'private, no-store')
      const body = await response.json()
      assert.equal(body.total, 121)
      seen.push(...body.invitations.map((row) => row.id))
      cursor = body.nextCursor
      pages++
    } while (cursor)
    assert.equal(pages, 3)
    assert.equal(seen.length, 121)
    assert.equal(new Set(seen).size, 121)
    assert.equal(seen.at(-1), 'invite-001')
  })
  await check('foreign and malformed cursors are rejected', async () => {
    for (const cursor of ['', 'foreign-invite', 'bad!']) {
      const response = await route.GET(request(`&cursor=${encodeURIComponent(cursor)}`))
      assert.equal(response.status, 400)
    }
  })
  await check('nonmembers cannot list invitation tokens', async () => {
    const response = await route.GET({ nextUrl: new URL('http://offline.invalid/?type=sent&workspaceId=foreign-workspace') })
    assert.equal(response.status, 403)
  })
  await check('database errors do not disclose internal details', async () => {
    failCount = true
    const response = await route.GET(request(''))
    failCount = false
    assert.equal(response.status, 500)
    assert.equal((await response.json()).error, '取得に失敗しました')
  })
})().catch((error) => { console.error(error); process.exitCode = 1 })
