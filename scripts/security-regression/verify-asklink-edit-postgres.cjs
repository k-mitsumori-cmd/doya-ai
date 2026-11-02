// Actual PATCH/DTO/Prisma against a private Unix-socket PostgreSQL, never application credentials.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), crypto = require('node:crypto')
const root = path.resolve(__dirname, '../..'), { PrismaClient } = require('@prisma/client'), { load } = require('./load-typescript.cjs')
const connection = process.env.DOYA_PRIVATE_TEST_DATABASE_URL, socket = process.env.DOYA_PRIVATE_TEST_SOCKET
assert(connection && socket); const url = new URL(connection)
assert.equal(url.hostname, 'localhost'); assert.equal(url.password, ''); assert.equal(url.port, '56489'); assert.equal(url.searchParams.get('host'), socket); assert.match(socket, /^\/tmp\/doya-asklink-edit-[^/]+\/socket$/)
const db = new PrismaClient({ datasources: { db: { url: connection } } })
const id = 'csyntheticaudit0000000000', owner = 'synthetic-owner', links = load('src/lib/asklink/link.ts')
let actor = owner, reads = 0, attempts = 0, conflicts = 0, successes = 0, directWrites = 0, signedCalls = 0
let pair = false, initialReads = 0, releasePair, gate, conflictWrites = 0, competingRevision = 0, deleteBefore = false, deleteAfter = false
async function beforeWrite() {
  if (deleteBefore) { deleteBefore = false; await db.askLinkRun.delete({ where: { id } }) }
  if (conflictWrites > 0) {
    conflictWrites--; competingRevision++
    const latest = await db.askLinkRun.findUniqueOrThrow({ where: { id } })
    await db.askLinkRun.update({ where: { id }, data: { links: latest.links.map(l => l.key === 'consult' ? links.buildLink(l.key, l.title, 'Synthetic competitor ' + competingRevision, l.question, latest.allowedUrls) : l) } })
  }
}
async function afterWrite(succeeded) {
  if (deleteAfter && succeeded) { deleteAfter = false; await db.askLinkRun.delete({ where: { id } }) }
}
const prisma = { askLinkRun: {
  findFirst: async args => {
    assert.equal(args.where.id, id); assert.equal(args.where.userId, actor)
    const snapshot = await db.askLinkRun.findFirst(args); reads++
    if (pair && !args.select.banners) {
      initialReads++; if (initialReads === 2) releasePair()
      if (initialReads <= 2) await gate
    }
    return snapshot
  },
  update: async args => { directWrites++; await beforeWrite(); const result = await db.askLinkRun.update(args); await afterWrite(true); return result },
  updateMany: async args => {
    attempts++; assert.equal(args.where.id, id); assert.equal(args.where.userId, actor)
    assert(args.where.links && Array.isArray(args.where.links.equals), 'write must compare the entire read JSON value')
    await beforeWrite()
    const result = await db.askLinkRun.updateMany(args)
    if (result.count === 0) conflicts++; else successes++
    await afterWrite(result.count > 0)
    return result
  },
} }
const access = load('src/lib/asklink/access.ts', {
  'next-auth': { getServerSession: async () => actor ? { user: { id: actor } } : null },
  '@/lib/auth': { authOptions: {} }, '@/lib/prisma': { prisma },
  '@/lib/plan-limit': new Proxy({}, { get: () => () => { throw Error('Quota/provider work forbidden') } }),
})
const dto = load('src/lib/asklink/dto.ts', { '@/lib/adimage/storage': { signedUrl: () => { signedCalls++; throw Error('Storage forbidden') } }, './types': load('src/lib/asklink/types.ts') })
const routePath = 'src/app/api/asklink/runs/[id]/route.ts'
const route = load(routePath, { '@/lib/prisma': { prisma }, '@/lib/asklink/access': access, '@/lib/asklink/dto': dto, '@/lib/asklink/link': links })
const original = [links.buildLink('understand', 'Synthetic A', 'Button A', 'Synthetic original A', []), links.buildLink('consult', 'Synthetic B', 'Button B', 'Synthetic original B', [])]
const clean = value => JSON.parse(JSON.stringify(value)), results = []
async function fresh() {
  pair = false; initialReads = 0; conflictWrites = 0; competingRevision = 0; deleteBefore = false; deleteAfter = false; actor = owner
  reads = attempts = conflicts = successes = directWrites = signedCalls = 0
  await db.askLinkBanner.deleteMany(); await db.askLinkRun.deleteMany()
  await db.askLinkRun.create({ data: { id, userId: owner, sourceUrl: 'https://synthetic.invalid', source: 'manual', site: { name: 'Synthetic site' }, allowedUrls: [], bannerCopy: { sentinel: 'retain' }, links: clean(original) } })
}
async function patch(edits, reqOverride) {
  const response = await route.PATCH(reqOverride || new Request('https://synthetic.invalid/api/asklink/runs/' + id, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ links: edits }) }), { params: Promise.resolve({ id }) })
  assert.match(response.headers.get('cache-control'), /private/); assert.match(response.headers.get('cache-control'), /no-store/); assert.match(response.headers.get('vary'), /cookie/i)
  return { status: response.status, body: await response.json() }
}
async function check(name, fn) {
  await fresh()
  try { await fn(); assert.equal(signedCalls, 0); results.push({ name, passed: true }); console.log('PASS ' + name) }
  catch (error) { results.push({ name, passed: false, error: error.message.slice(0, 250) }); console.log('FAIL ' + name) }
}
;(async () => {
  const identity = await db.$queryRawUnsafe('SELECT current_user AS actor, current_database() AS database, inet_server_addr() AS address')
  assert.equal(identity[0].actor, 'doya_asklink_edit'); assert.equal(identity[0].database, 'postgres'); assert.equal(identity[0].address, null)
  await db.$executeRawUnsafe('CREATE TABLE asklink_run ("id" TEXT PRIMARY KEY, "userId" TEXT NOT NULL, "sourceUrl" TEXT NOT NULL, "audience" TEXT NOT NULL DEFAULT \'b2b\', "detectedAudience" TEXT NOT NULL DEFAULT \'b2b\', "site" JSONB NOT NULL, "allowedUrls" JSONB NOT NULL, "source" TEXT NOT NULL DEFAULT \'site\', "links" JSONB, "bannerCopy" JSONB, "linkGenerations" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL)')
  await db.$executeRawUnsafe('CREATE TABLE asklink_banner ("id" TEXT PRIMARY KEY, "runId" TEXT NOT NULL REFERENCES asklink_run("id") ON DELETE CASCADE, "kind" TEXT NOT NULL, "imagePath" TEXT, "status" TEXT NOT NULL DEFAULT \'pending\', "verify" JSONB, "model" TEXT, "generations" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, UNIQUE ("runId", "kind"))')
  await check('AskLink native single-link edit retains other link and metadata', async () => {
    const r = await patch([{ key: 'understand', question: 'Synthetic edited A' }]); assert.equal(r.status, 200)
    const saved = await db.askLinkRun.findUniqueOrThrow({ where: { id } }); assert.deepEqual(saved.links[1], clean(original[1])); assert.equal(saved.links[0].buttonLabel, original[0].buttonLabel)
    assert.equal(saved.links[0].question, 'Synthetic edited A'); assert.equal(new URL(saved.links[0].url).searchParams.get('q'), 'Synthetic edited A')
    assert.deepEqual(saved.bannerCopy, { sentinel: 'retain' }); assert.deepEqual(saved.site, { name: 'Synthetic site' }); assert.equal(saved.linkGenerations, 0)
    assert.equal(r.body.run.banners.length, 3); assert.deepEqual(r.body.run.links, saved.links); assert.equal(attempts, 1); assert.equal(directWrites, 0)
  })
  await check('AskLink native concurrent independent edits both survive a read barrier', async () => {
    pair = true; gate = new Promise(resolve => { releasePair = resolve })
    const r = await Promise.all([patch([{ key: 'understand', question: 'Synthetic edited A' }]), patch([{ key: 'consult', question: 'Synthetic edited B' }])]); assert(r.every(x => x.status === 200))
    const saved = await db.askLinkRun.findUniqueOrThrow({ where: { id } }); assert.equal(saved.links[0].question, 'Synthetic edited A'); assert.equal(saved.links[1].question, 'Synthetic edited B')
    assert.equal(successes, 2); assert.equal(conflicts, 1); assert.equal(attempts, 3); assert.equal(directWrites, 0)
  })
  await check('AskLink native repeated identical edit creates no duplicate result', async () => {
    const edit = [{ key: 'understand', buttonLabel: 'Edited label', question: 'Synthetic repeated edit' }]
    assert.equal((await patch(edit)).status, 200); const first = await db.askLinkRun.findUniqueOrThrow({ where: { id } }); assert.equal((await patch(edit)).status, 200)
    const second = await db.askLinkRun.findUniqueOrThrow({ where: { id } }); assert.deepEqual(first.links, second.links); assert.equal(await db.askLinkRun.count(), 1); assert.equal(successes, 2)
  })
  await check('AskLink native owner denial precedes body parsing and makes no writes', async () => {
    const forbiddenBody = { json: () => { throw Error('Denied request body must not be parsed') } }
    actor = 'synthetic-other'; assert.equal((await patch([], forbiddenBody)).status, 404)
    actor = null; assert.equal((await patch([], forbiddenBody)).status, 401)
    assert.equal(attempts, 0); assert.equal(directWrites, 0); assert.deepEqual((await db.askLinkRun.findUniqueOrThrow({ where: { id } })).links, clean(original))
  })
  await check('AskLink native conflict reload preserves the competing unrelated edit', async () => {
    conflictWrites = 2; const r = await patch([{ key: 'understand', question: 'Synthetic edited A' }]); assert.equal(r.status, 200)
    const saved = await db.askLinkRun.findUniqueOrThrow({ where: { id } }); assert.equal(saved.links[0].question, 'Synthetic edited A'); assert.equal(saved.links[1].buttonLabel, 'Synthetic competitor 2')
    assert.equal(attempts, 3); assert.equal(conflicts, 2); assert.equal(successes, 1)
  })
  await check('AskLink native conflict exhaustion is bounded and does not claim success', async () => {
    conflictWrites = 99; const r = await patch([{ key: 'understand', question: 'Synthetic unsaved draft' }]); assert.equal(r.status, 409); assert.equal(r.body.run, undefined)
    assert.equal(attempts, 5); assert.equal(conflicts, 5); assert.equal(successes, 0)
    const saved = await db.askLinkRun.findUniqueOrThrow({ where: { id } }); assert.equal(saved.links[0].question, original[0].question); assert.equal(saved.links[1].buttonLabel, 'Synthetic competitor 5')
  })
  await check('AskLink native deletion before compare returns404 without recreation', async () => {
    deleteBefore = true; const r = await patch([{ key: 'understand', question: 'Synthetic edit' }]); assert.equal(r.status, 404); assert.equal(await db.askLinkRun.count(), 0); assert.equal(attempts, 1)
  })
  await check('AskLink native deletion after compare returns404 without an invalid DTO', async () => {
    deleteAfter = true; const r = await patch([{ key: 'understand', question: 'Synthetic edit' }]); assert.equal(r.status, 404); assert.equal(r.body.run, undefined); assert.equal(await db.askLinkRun.count(), 0); assert.equal(successes, 1)
  })
})().catch(error => { results.push({ name: 'harness', passed: false, error: String(error.message).replace(/postgres(?:ql)?:\/\/[^\s]+/g, '[private-test-url]').slice(0, 300) }) }).finally(async () => {
  await db.$disconnect()
  const file = path.join(process.env.DOYA_TEST_BASELINE || root, routePath)
  const report = { checkedAt: new Date().toISOString(), passed: results.filter(r => r.passed).length, failed: results.filter(r => !r.passed).length, expectedCases: 8, results, source: { path: routePath, sha256: crypto.createHash('sha256').update(fs.readFileSync(fs.existsSync(file) ? file : path.join(root, routePath))).digest('hex') }, scope: 'Actual PATCH/access/link builder/DTO and real Prisma against native private PostgreSQL; controlled read barriers and real competing updates/deletions. Synthetic auth/data, storage signing forbidden. Two model tables matching route query fields, not production schema migration or real account/browser/LLM/entire save-family proof. Launcher independently verifies Unix-only connection and server stop.' }
  const out = process.env.DOYA_ASKLINK_EDIT_PG_OUTPUT || path.join(root, 'docs/audits/2026-10-06-all-services-recheck/asklink-edit-postgres-results.json')
  fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify({ passed: report.passed, failed: report.failed, expectedCases: 8 })); if (report.failed || results.length !== 8) process.exitCode = 1
})
