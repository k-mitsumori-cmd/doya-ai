import assert from 'node:assert/strict'
import { seoArticleActivity } from '../../seo/lib/job-response'
import { test } from 'node:test'
import { Prisma, PrismaClient } from '@prisma/client'
import { parseSeoListQuery, readSeoArticleList, type SeoListActivity } from '../../src/lib/seo-article-list'

const now = new Date('2026-10-28T00:00:00.000Z')
const at = (delta: number) => new Date(now.getTime() + delta)
const old = at(-48 * 60 * 60 * 1000)
type Job = { id?: string; status?: string; updatedAt?: Date; executionToken?: string | null; executionExpiresAt?: Date | null; supersededAt?: Date | null }
type Fixture = { id: string; status?: string; updatedAt?: Date; jobs?: Job[]; activity: SeoListActivity }

test('SEO list preserves ownership, read-only state and pagination while reporting actual execution activity', { timeout: 90000 }, async () => {
  const connection = process.env.DOYA_PRIVATE_TEST_DATABASE_URL
  const socket = process.env.DOYA_PRIVATE_TEST_SOCKET
  assert.ok(connection && socket, 'Run through seo-list-postgres.py; no ambient database is allowed')
  const url = new URL(connection)
  assert.equal(url.hostname, 'localhost')
  assert.equal(url.password, '')
  assert.equal(url.searchParams.get('host'), socket)
  assert.match(socket, /^\/tmp\/doya-seo-list-[^/]+\/socket$/)
  const db = new PrismaClient({ datasources: { db: { url: connection } } })
  try {
    await db.$executeRawUnsafe(`CREATE TABLE "SeoArticle" (
      id text PRIMARY KEY, "userId" text, "guestId" text, title text NOT NULL, keywords jsonb,
      status text NOT NULL, "targetChars" integer NOT NULL DEFAULT 3000,
      "createdAt" timestamp NOT NULL, "updatedAt" timestamp NOT NULL)`)
    await db.$executeRawUnsafe(`CREATE TABLE "SeoJob" (
      id text PRIMARY KEY, "articleId" text NOT NULL REFERENCES "SeoArticle"(id), status text NOT NULL,
      progress integer NOT NULL DEFAULT 0, step text NOT NULL DEFAULT 'init',
      "createdAt" timestamp NOT NULL, "updatedAt" timestamp NOT NULL,
      "executionToken" text, "executionExpiresAt" timestamp, "supersededAt" timestamp)`)
    await db.$executeRawUnsafe(`CREATE TABLE "SeoImage" (
      id text PRIMARY KEY, "articleId" text NOT NULL REFERENCES "SeoArticle"(id),
      kind text NOT NULL, "createdAt" timestamp NOT NULL)`)

    const fixtures: Fixture[] = [
      { id: 'active-old', jobs: [{ executionToken: 'PRIVATE_ACTIVE', executionExpiresAt: at(60000) }], activity: 'executing' },
      { id: 'active-queued', jobs: [{ status: 'queued', executionToken: 'PRIVATE_QUEUED', executionExpiresAt: at(60000) }], activity: 'executing' },
      { id: 'waiting-recent', jobs: [{ status: 'queued', updatedAt: at(-60000) }], activity: 'waiting' },
      { id: 'expired-recent', jobs: [{ updatedAt: at(-60000), executionToken: 'PRIVATE_EXPIRED', executionExpiresAt: at(-1) }], activity: 'waiting' },
      { id: 'stale-expired', jobs: [{ executionToken: 'PRIVATE_STALE', executionExpiresAt: at(-1) }], activity: 'needs-review' },
      { id: 'stale-queued', jobs: [{ status: 'queued' }], activity: 'needs-review' },
      { id: 'stale-missing-job', activity: 'needs-review' },
      { id: 'paused-recent', jobs: [{ status: 'paused', updatedAt: now, executionToken: 'PRIVATE_PAUSED', executionExpiresAt: at(60000) }], activity: 'needs-review' },
      { id: 'superseded-recent', jobs: [{ updatedAt: now, executionToken: 'PRIVATE_SUPERSEDED', executionExpiresAt: at(60000), supersededAt: now }], activity: 'needs-review' },
      { id: 'finished-job', jobs: [{ status: 'done', updatedAt: now }], activity: 'needs-review' },
      { id: 'stale-boundary', jobs: [{ updatedAt: at(-24 * 60 * 60 * 1000) }], activity: 'needs-review' },
      { id: 'recent-boundary', jobs: [{ updatedAt: at(-24 * 60 * 60 * 1000 + 1) }], activity: 'waiting' },
      { id: 'edited-article-stale-job', updatedAt: now, jobs: [{}], activity: 'needs-review' },
      { id: 'tie-latest', jobs: [
        { id: 'tie-a', executionToken: 'PRIVATE_OLDER', executionExpiresAt: at(60000) },
        { id: 'tie-z', status: 'paused' },
      ], activity: 'needs-review' },
      { id: 'done', status: 'DONE', jobs: [{ executionToken: 'PRIVATE_IGNORED', executionExpiresAt: at(60000) }], activity: null },
      { id: 'exported', status: 'EXPORTED', activity: null },
      { id: 'draft', status: 'DRAFT', activity: null },
      { id: 'error', status: 'ERROR', activity: null },
    ]
    for (const fixture of fixtures) {
      await db.$executeRaw`INSERT INTO "SeoArticle" (id, "userId", "guestId", title, keywords, status, "createdAt", "updatedAt")
        VALUES (${fixture.id}, 'owner', 'shared-guest', ${fixture.id}, '[]'::jsonb, ${fixture.status ?? 'RUNNING'}, ${now}, ${fixture.updatedAt ?? old})`
      for (const [index, job] of (fixture.jobs ?? []).entries()) {
        await db.$executeRaw`INSERT INTO "SeoJob" (id, "articleId", status, "createdAt", "updatedAt", "executionToken", "executionExpiresAt", "supersededAt")
          VALUES (${job.id ?? `${fixture.id}-job-${index}`}, ${fixture.id}, ${job.status ?? 'running'}, ${now},
            ${job.updatedAt ?? old}, ${job.executionToken ?? null}, ${job.executionExpiresAt ?? null}, ${job.supersededAt ?? null})`
      }
    }
    for (let i = 0; i < 60; i++) {
      const id = `z-fill-${String(i).padStart(3, '0')}`
      await db.$executeRaw`INSERT INTO "SeoArticle" (id, "userId", title, keywords, status, "createdAt", "updatedAt") VALUES (${id}, 'owner', ${id}, '[]'::jsonb, 'DRAFT', ${now}, ${now})`
    }
    await db.$executeRaw`INSERT INTO "SeoArticle" (id, "userId", "guestId", title, keywords, status, "createdAt", "updatedAt") VALUES
      ('special', 'owner', NULL, 'Literal %_ title', '["日本語_%"]'::jsonb, 'DRAFT', ${now}, ${now}),
      ('malformed-keywords', 'owner', NULL, 'Not a keyword array', '{"ignored":"日本語_%"}'::jsonb, 'DRAFT', ${now}, ${now}),
      ('guest-only', NULL, 'shared-guest', 'Guest article', '[]'::jsonb, 'DRAFT', ${now}, ${now}),
      ('other-owner', 'other', 'shared-guest', 'Other owner', '[]'::jsonb, 'RUNNING', ${now}, ${old})`
    await db.$executeRaw`INSERT INTO "SeoImage" (id, "articleId", kind, "createdAt") VALUES
      ('image-a', 'special', 'BANNER', ${now}), ('image-b', 'special', 'BANNER', ${now}), ('image-z', 'special', 'DIAGRAM', ${now})`

    const snapshot = async () => {
      const tables = ['SeoArticle', 'SeoJob', 'SeoImage']
      return Promise.all(tables.map(table => db.$queryRawUnsafe<{ hash: string }[]>(
        `SELECT md5(string_agg(row_to_json(t)::text, '' ORDER BY id)) AS hash FROM "${table}" t`)))
    }
    const before = await snapshot()
    // Cursor and lease comparisons must remain UTC even when the connection is not.
    await db.$executeRawUnsafe("SET TIME ZONE 'Asia/Tokyo'")
    const read = (owner: { userId: string } | { userId: null; guestId: string }, params = new URLSearchParams()) =>
      db.$transaction(tx => readSeoArticleList(tx, owner, parseSeoListQuery(params), now), { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead })

    const first = await read({ userId: 'owner' })
    assert.equal(first.articles.length, 50)
    assert.ok(first.nextCursor)
    const second = await read({ userId: 'owner' }, new URLSearchParams({ cursor: first.nextCursor }))
    assert.equal(second.nextCursor, null)
    const articles = [...first.articles, ...second.articles]
    assert.equal(articles.length, fixtures.length + 62)
    assert.equal(new Set(articles.map(article => article.id)).size, articles.length)
    assert.equal(first.counts.total, articles.length)
    assert.equal(first.counts.running, fixtures.filter(fixture => !fixture.status).length)
    assert.equal(first.counts.executing, 2)
    assert.equal(first.counts.needsReview, fixtures.filter(fixture => fixture.activity === 'needs-review').length)
    assert.equal(first.counts.polling, 5)
    assert.equal(first.counts.done, 2)
    for (const fixture of fixtures) {
      assert.equal(articles.find(article => article.id === fixture.id)?.activityState, fixture.activity, fixture.id)
      const stored = await db.seoArticle.findUniqueOrThrow({ where: { id: fixture.id }, select: {
        status: true, updatedAt: true, jobs: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 1,
          select: { status: true, updatedAt: true, executionToken: true, executionExpiresAt: true, supersededAt: true } },
      } })
      assert.equal(seoArticleActivity(stored.status, stored.updatedAt, stored.jobs[0], now), fixture.activity, `detail/list parity: ${fixture.id}`)
    }
    assert.equal(articles.find(article => article.id === 'tie-latest')?.jobs[0]?.id, 'tie-z')
    assert.equal(articles.find(article => article.id === 'special')?.images[0]?.id, 'image-b')
    assert.deepEqual(articles.find(article => article.id === 'malformed-keywords')?.keywords, [])
    assert.equal(JSON.stringify(articles).includes('PRIVATE_'), false)
    assert.ok(articles.every(article => !['guest-only', 'other-owner'].includes(article.id)))

    const running = await read({ userId: 'owner' }, new URLSearchParams({ status: 'RUNNING' }))
    assert.equal(running.matched, first.counts.running)
    assert.ok(running.articles.every(article => article.status === 'RUNNING'))
    const done = await read({ userId: 'owner' }, new URLSearchParams({ status: 'DONE' }))
    assert.deepEqual(done.articles.map(article => article.status).sort(), ['DONE', 'EXPORTED'])
    const literal = await read({ userId: 'owner' }, new URLSearchParams({ q: '%_' }))
    assert.deepEqual(literal.articles.map(article => article.id), ['special'])
    const keyword = await read({ userId: 'owner' }, new URLSearchParams({ q: '日本語' }))
    assert.deepEqual(keyword.articles.map(article => article.id), ['special'])
    const guest = await read({ userId: null, guestId: 'shared-guest' })
    assert.deepEqual(guest.articles.map(article => article.id), ['guest-only'])
    const other = await read({ userId: 'other' })
    assert.deepEqual(other.articles.map(article => article.id), ['other-owner'])
    const unknown = await read({ userId: "unknown' OR 1=1 --" })
    assert.equal(unknown.counts.total, 0)
    assert.deepEqual(unknown.articles, [])
    assert.deepEqual(await snapshot(), before, 'Listing must not modify articles, jobs or images')
  } finally {
    await db.$disconnect()
  }
})
