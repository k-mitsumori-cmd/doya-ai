const assert = require('node:assert/strict')
const fs = require('node:fs')
const { load, check } = require('./load-typescript.cjs')

const helper = load('src/lib/aio/prompt-mutation.ts', { 'node:crypto': require('node:crypto') })
const version = load('src/lib/org-profile-version.ts')
const json = (body, options = {}) => ({ body, status: options.status || 200 })
const access = {
  getAioContext: async () => ({ organizationId: 'org-1', organizationSlug: 'alpha', userId: 'user-1', memberId: 'member-1', role: 'manager' }),
  hasMinRole: () => true,
  orgSlugFrom: () => undefined,
}

;(async () => {
  await check('archiving a prompt retains its result foreign key', async () => {
    let archived = false
    let active = true
    let deleted = false
    const tx = {
      $queryRaw: async () => [{ id: 'org-1' }],
      aioMember: { findFirst: async () => ({ id: 'member-1', role: 'manager' }) },
      aioPrompt: {
        findFirst: async () => ({ id: 'prompt-1', updatedAt: new Date('2026-10-07T00:00:00.000Z') }),
        updateMany: async ({ where, data }) => {
          assert.equal(where.id, 'prompt-1')
          assert.equal(where.organizationId, 'org-1')
          assert.equal(where.archivedAt, null)
          assert(data.archivedAt instanceof Date)
          assert.equal(data.isActive, false)
          archived = true
          active = false
          return { count: 1 }
        },
        delete: async () => { deleted = true },
      },
    }
    const prisma = { $transaction: async (fn) => fn(tx) }
    const route = load('src/app/api/aio/prompts/[id]/route.ts', {
      'next/server': { NextResponse: { json } }, '@/lib/prisma': { prisma }, '@/lib/aio/access': access, '@/lib/aio/prompt-mutation': helper, '@/lib/org-profile-version': version,
    })
    const response = await route.DELETE({ text: async () => '' }, { params: Promise.resolve({ id: 'prompt-1' }) })
    assert.equal(response.status, 200)
    assert.equal(response.body.archived, true)
    assert.equal(archived, true)
    assert.equal(active, false)
    assert.equal(deleted, false)
  })

  await check('archived prompts do not appear in the list or consume the free slot', async () => {
    let created = false
    const prisma = {
      aioPrompt: { findMany: async ({ where }) => {
        assert.equal(where.archivedAt, null)
        return [{ id: 'live' }]
      } },
      $transaction: async (fn) => fn({
        $queryRaw: async () => [{ id: 'org-1' }],
      aioMember: { findFirst: async () => ({ id: 'member-1', role: 'manager' }) },
        aioPrompt: {
          count: async ({ where }) => { assert.equal(where.archivedAt, null); return 2 },
          create: async ({ data }) => { created = true; return { id: 'new', ...data } },
        },
      }),
    }
    const route = load('src/app/api/aio/prompts/route.ts', {
      'next/server': { NextResponse: { json } }, '@/lib/prisma': { prisma }, '@/lib/aio/access': access, '@/lib/aio/prompt-mutation': helper, '@/lib/org-profile-version': version,
      '@/lib/aio/billing': { getAioBilling: async () => ({ plan: 'FREE' }) },
      '@/lib/unified-plan': { isPaidPlan: () => false },
    })
    const listed = await route.GET({ nextUrl: new URL('https://example.invalid/?org=alpha') })
    assert.deepEqual(listed.body.prompts, [{ id: 'live' }])
    const added = await route.POST({ json: async () => ({ text: '新しい質問' }) })
    assert.equal(added.status, 200)
    assert.equal(created, true)
  })

  await check('archived prompts cannot be edited or measured', async () => {
    const route = load('src/app/api/aio/prompts/[id]/route.ts', {
      'next/server': { NextResponse: { json } },
      '@/lib/prisma': { prisma: { $transaction: async fn => fn({ $queryRaw: async () => [{ id: 'org-1' }], aioMember: { findFirst: async () => ({ id: 'member-1', role: 'manager' }) }, aioPrompt: { findFirst: async ({ where }) => {
        assert.equal(where.archivedAt, null)
        return null
      } } }) } },
      '@/lib/aio/access': access, '@/lib/aio/prompt-mutation': helper, '@/lib/org-profile-version': version,
    })
    const response = await route.PATCH({ text: async () => JSON.stringify({ isActive: true }) }, { params: Promise.resolve({ id: 'archived' }) })
    assert.equal(response.status, 404)
    const runSource = fs.readFileSync('src/lib/aio/run.ts', 'utf8')
    const scanSource = fs.readFileSync('src/app/api/aio/scans/route.ts', 'utf8')
    assert.match(runSource, /aioPrompt\.findMany\(\{ where: \{ organizationId, isActive: true, archivedAt: null \}/)
    assert.match(scanSource, /aioPrompt\.findMany\(\{ where: \{ organizationId: ctx\.organizationId, isActive: true, archivedAt: null \}/)
  })

  await check('archive field and additive SQL exist', () => {
    assert.match(fs.readFileSync('prisma/schema.prisma', 'utf8'), /model AioPrompt \{[\s\S]*?archivedAt\s+DateTime\?/)
    const sql = fs.readFileSync('prisma/manual-migrations/2026-10-05-aio-prompt-archive.sql', 'utf8')
    assert.match(sql, /ALTER TABLE "aio_prompts"\s+ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP\(3\)/)
  })
})().catch((error) => { console.error(error); process.exitCode = 1 })
