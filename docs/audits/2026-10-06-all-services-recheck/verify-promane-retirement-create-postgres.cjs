process.env.NODE_ENV = 'test'
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { Prisma } = require('@prisma/client')
const { createRequire } = require('node:module')
const { load } = require('../../../scripts/security-regression/load-typescript.cjs')
const base = 'docs/audits/2026-10-06-all-services-recheck/'
const fixture = base + 'verify-adimage-operation-postgres.cjs'
const prefix = fs.readFileSync(fixture, 'utf8').split('async function makeBudget()')[0].replace("'AdImageFeedback']", "'AdImageFeedback','PromaneWorkspace','PromaneMember','PromaneProject']")
const { db, setupDb } = new Function('require', '__dirname', prefix + '\nreturn { db, setupDb }')(
  createRequire(path.resolve(fixture)), path.dirname(path.resolve(fixture)))
const state = load('src/lib/account-lifecycle/state.ts', { 'node:crypto': crypto })
const store = load('src/lib/account-lifecycle/store.ts', { 'node:crypto': crypto, '@prisma/client': { Prisma }, './state': state })
const retirement = load('src/lib/account-retirement.ts', { '@prisma/client': { Prisma } })
const operation = load('src/lib/promane/workspace-operation.ts', { 'node:crypto': crypto })
const input = load('src/lib/promane/workspace-input.ts')
const limits = load('src/lib/promane/limits.ts', { '@/lib/prisma': { prisma: db }, '@/lib/plan-utils': load('src/lib/plan-utils.ts') })
const mutations = load('src/lib/promane/workspace-mutations.ts', {
  'node:crypto': crypto, '@/lib/prisma': { prisma: db }, '@/lib/promane/limits': limits,
  './workspace-input': input, './workspace-operation': operation,
  '@/lib/account-lifecycle/store': store, '@/lib/account-lifecycle/state': state,
})
const auth = load('src/lib/promane/auth.ts', {
  'next-auth': { getServerSession: async () => null }, '@/lib/auth': { authOptions: {} },
  '@/lib/prisma': { prisma: db }, 'next/navigation': { redirect: () => { throw Error('Unexpected redirect') } },
  crypto, '@/lib/account-lifecycle/store': store, '@/lib/account-lifecycle/state': state,
  './workspace-operation': operation,
})
const digest = crypto.createHash('sha256').update('synthetic Promane retirement create R1').digest('hex')
const owner = 'owner'
const reserve = () => store.reserveLifecycleOperation(db, {
  operator: { kind: 'admin', id: 'synthetic_admin' }, targetUserId: owner,
  operationId: crypto.randomUUID(), kind: 'retirement',
}, digest)
const body = () => ({ name: 'Synthetic workspace', operationId: crypto.randomUUID(), expectedUserId: owner })
async function reset() {
  await db.$executeRawUnsafe('TRUNCATE "User", "SystemSetting", promane_workspaces CASCADE')
  await db.$executeRawUnsafe('INSERT INTO "User" (id,plan,name) VALUES ($1,$2,$3)', owner, 'PRO', 'Synthetic owner')
}
async function setupRetirementPreflightTables() {
  const models = require('../../../scripts/security-regression/retirement-fixture.cjs').retirementModels
    .filter(name => !['PromaneWorkspace', 'PromaneMember'].includes(name))
  const quote = value => '"' + value.replaceAll('"', '""') + '"'
  for (const name of models) {
    const model = Prisma.dmmf.datamodel.models.find(row => row.name === name)
    assert(model, name)
    const columns = model.fields.filter(field => field.kind !== 'object').map(field => {
      const type = ({ String: 'TEXT', Int: 'INTEGER', Boolean: 'BOOLEAN', DateTime: 'TIMESTAMP(3)', Json: 'JSONB', Float: 'DOUBLE PRECISION', BigInt: 'BIGINT', Decimal: 'DECIMAL' })[field.type] || 'TEXT'
      const defaultValue = field.type === 'DateTime' && (field.isUpdatedAt || field.default?.name === 'now') ? ' DEFAULT CURRENT_TIMESTAMP'
        : field.hasDefaultValue && ['string', 'number', 'boolean'].includes(typeof field.default) ? ' DEFAULT ' + (typeof field.default === 'string' ? "'" + field.default.replaceAll("'", "''") + "'" : String(field.default)) : ''
      return quote(field.dbName || field.name) + ' ' + type + (field.isList ? '[]' : '') + (field.isRequired ? ' NOT NULL' : '') + defaultValue + (field.isId ? ' PRIMARY KEY' : '') + (field.isUnique ? ' UNIQUE' : '')
    })
    for (const fields of model.uniqueFields) columns.push('UNIQUE (' + fields.map(quote).join(',') + ')')
    await db.$executeRawUnsafe('CREATE TABLE ' + quote(model.dbName || name) + ' (' + columns.join(',') + ')')
  }
}
const snapshot = async () => ({
  workspaces: await db.promaneWorkspace.count(), members: await db.promaneMember.count(),
  promaneReceipts: await db.systemSetting.count({ where: { key: { startsWith: 'promane-workspace:v1:' } } }),
  lifecycleRows: await db.systemSetting.count({ where: { key: { startsWith: 'doya-account-' } } }),
  lifecycleEntries: await db.systemSetting.findMany({ where: { key: { startsWith: 'doya-account-' } }, select: { key: true, value: true }, orderBy: { key: 'asc' } }),
  settingEntries: await db.systemSetting.findMany({ select: { key: true, value: true }, orderBy: { key: 'asc' } }),
})
const observed = []
const cases = []
const lockWaitEvidence = []
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { promise, resolve } }
const settle = promise => promise.then(value => ({ ok: true, value }), error => ({ ok: false, error }))
const waitForStarted = (entered, holder) => Promise.race([entered.promise, holder.then(result => { throw result.error || Error('Held transaction exited before lock barrier') })])
const bounded = async (promise, label) => { let timer; try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(Error('Timed out: ' + label)), 10000) })]) } finally { clearTimeout(timer) } }
function candidateWithPrisma(prisma) {
  return {
    first: load('src/lib/promane/auth.ts', {
      'next-auth': { getServerSession: async () => null }, '@/lib/auth': { authOptions: {} },
      '@/lib/prisma': { prisma }, 'next/navigation': { redirect: () => { throw Error('Unexpected redirect') } },
      crypto, '@/lib/account-lifecycle/store': store, '@/lib/account-lifecycle/state': state, './workspace-operation': operation,
    }),
    explicit: load('src/lib/promane/workspace-mutations.ts', {
      'node:crypto': crypto, '@/lib/prisma': { prisma }, '@/lib/promane/limits': limits,
      './workspace-input': input, './workspace-operation': operation, '@/lib/account-lifecycle/store': store, '@/lib/account-lifecycle/state': state,
    }),
  }
}
async function waitForUserRowLock(holderPid, name) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const rows = await db.$queryRawUnsafe('SELECT pid, wait_event_type AS "waitType", pg_blocking_pids(pid) AS blockers, query FROM pg_stat_activity WHERE pid <> pg_backend_pid() AND wait_event_type = $1', 'Lock')
    const blocked = rows.find(row => row.blockers.includes(holderPid) && row.query.includes('"User"'))
    if (blocked) {
      lockWaitEvidence.push({ name, holderPid, waiterPid: blocked.pid, waitType: blocked.waitType, blockedByHolder: true })
      return
    }
    await new Promise(done => setTimeout(done, 25))
  }
  throw Error('Expected actual User row lock wait: ' + name)
}
async function observe(name, write) {
  await reset()
  await reserve()
  const before = await snapshot()
  let result, failure
  try { result = await write() } catch (error) { failure = { name: error?.constructor?.name, code: error?.code, message: error?.message } }
  const after = await snapshot()
  assert.equal(after.lifecycleRows, before.lifecycleRows, 'Retirement metadata must not mutate')
  assert.deepEqual(after.lifecycleEntries, before.lifecycleEntries, 'Retirement metadata key/value must not mutate')
  observed.push({ name, before, after, resultState: result?.state || (result?.id ? 'workspace' : null), failure })
}
async function check(name, work) {
  await reset()
  await work()
  cases.push(name)
  console.log('PASS ' + name)
}
;(async () => {
  try {
    await setupDb()
    await setupRetirementPreflightTables()
    await db.$executeRawUnsafe('ALTER TABLE "User" ADD COLUMN name TEXT')
    await db.$executeRawUnsafe('ALTER TABLE promane_workspaces ADD FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE')
    await db.$executeRawUnsafe('ALTER TABLE promane_members ADD FOREIGN KEY ("workspaceId") REFERENCES promane_workspaces(id) ON DELETE CASCADE')
    await db.$executeRawUnsafe('ALTER TABLE promane_members ADD FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE')
    await observe('explicit create after retirement reserve', () => mutations.createPromaneWorkspaceOperation(owner, body()))
    await observe('first setup after retirement reserve', () => auth.getOrCreateWorkspace(owner))
    const before = process.env.DOYA_PROMANE_R1_EXPECT === 'before'
    if (before) assert(observed.every(row => row.after.workspaces === 1 && row.after.members === 1), 'Expected both pre-fix writers to show the actual gap')
    else assert(observed.every(row => row.after.workspaces === 0 && row.after.members === 0 && row.after.promaneReceipts === 0 && row.failure), 'Both writers must reject with no new workspace/member/receipt')
    if (!before) {
      await check('retirement: missing status is read only and missing cancel writes no receipt', async () => {
        await reserve()
        const operationId = crypto.randomUUID(), intent = { mode: 'create', workspaceId: null, operationId, expectedUserId: owner }
        const prior = await snapshot()
        assert.equal((await mutations.recoverPromaneWorkspaceMutation(owner, { ...intent, cancelIfMissing: false })).state, 'missing')
        await assert.rejects(mutations.recoverPromaneWorkspaceMutation(owner, { ...intent, cancelIfMissing: true }), error => error.code === 'ACCOUNT_RETIREMENT_IN_PROGRESS')
        assert.deepEqual(await snapshot(), prior)
        await assert.rejects(mutations.createPromaneWorkspaceOperation(owner, { ...body(), operationId }), error => error.code === 'ACCOUNT_RETIREMENT_IN_PROGRESS')
        assert.deepEqual(await snapshot(), prior)
      })
      await check('existing saved receipt remains readable and replay does not create after retirement', async () => {
        const request = body(), saved = await mutations.createPromaneWorkspaceOperation(owner, request)
        await reserve()
        const prior = await snapshot()
        const intent = { mode: 'create', workspaceId: null, operationId: request.operationId, expectedUserId: owner, cancelIfMissing: true }
        assert.equal((await mutations.recoverPromaneWorkspaceMutation(owner, intent)).entry.id, saved.entry.id)
        assert.equal((await mutations.createPromaneWorkspaceOperation(owner, request)).entry.id, saved.entry.id)
        assert.deepEqual(await snapshot(), prior)
      })
      await check('cancelled receipt fences delayed create while retirement is reserved', async () => {
        const request = body(), intent = { mode: 'create', workspaceId: null, operationId: request.operationId, expectedUserId: owner, cancelIfMissing: true }
        assert.equal((await mutations.recoverPromaneWorkspaceMutation(owner, intent)).state, 'cancelled')
        await reserve()
        const prior = await snapshot()
        assert.equal((await mutations.recoverPromaneWorkspaceMutation(owner, intent)).state, 'cancelled')
        await assert.rejects(mutations.createPromaneWorkspaceOperation(owner, request), /取り消/)
        assert.deepEqual(await snapshot(), prior)
      })
      await check('non-retirement verified checkout reservation permits ordinary first setup', async () => {
        const identity = { operator: { kind: 'user', id: owner }, targetUserId: owner, operationId: crypto.randomUUID(), kind: 'checkout' }
        await store.reserveLifecycleOperation(db, identity, digest)
        const workspace = await auth.getOrCreateWorkspace(owner)
        assert(workspace?.id)
        assert.equal(await db.promaneMember.count(), 1)
      })
      await check('malformed lifecycle fence fails closed before first setup and explicit create', async () => {
        await db.systemSetting.create({ data: { key: state.lifecycleFenceKey(owner), value: '{bad' } })
        const prior = await snapshot()
        await assert.rejects(auth.getOrCreateWorkspace(owner), error => error.code === 'LIFECYCLE_STATE_UNAVAILABLE')
        await assert.rejects(mutations.createPromaneWorkspaceOperation(owner, body()), error => error.code === 'LIFECYCLE_STATE_UNAVAILABLE')
        assert.deepEqual(await snapshot(), prior)
      })
      for (const kind of ['receipt', 'ledger']) {
        await check('malformed lifecycle ' + kind + ' fails closed with unchanged metadata', async () => {
          const identity = { operator: { kind: 'admin', id: 'synthetic_admin' }, targetUserId: owner, operationId: crypto.randomUUID(), kind: 'retirement' }
          await store.reserveLifecycleOperation(db, identity, digest)
          const key = kind === 'receipt' ? state.lifecycleReceiptKey(identity) : state.lifecycleLedgerKey(identity)
          if (kind === 'receipt') await db.systemSetting.update({ where: { key }, data: { value: '{invalid' } })
          else await db.systemSetting.create({ data: { key, value: '{invalid' } })
          const prior = await snapshot()
          await assert.rejects(auth.getOrCreateWorkspace(owner), error => error.code === 'LIFECYCLE_STATE_UNAVAILABLE')
          await assert.rejects(mutations.createPromaneWorkspaceOperation(owner, body()), error => error.code === 'LIFECYCLE_STATE_UNAVAILABLE')
          assert.deepEqual(await snapshot(), prior)
        })
      }
      await check('rejected receipt remains readable during retirement without a new write', async () => {
        await db.$executeRawUnsafe('UPDATE "User" SET plan=$1 WHERE id=$2', 'FREE', owner)
        await mutations.createPromaneWorkspaceOperation(owner, body())
        const rejected = body()
        assert.equal((await mutations.createPromaneWorkspaceOperation(owner, rejected)).code, 'LIMIT_REACHED')
        await reserve()
        const prior = await snapshot()
        assert.equal((await mutations.createPromaneWorkspaceOperation(owner, rejected)).code, 'LIMIT_REACHED')
        assert.equal((await mutations.recoverPromaneWorkspaceMutation(owner, { mode: 'create', workspaceId: null, operationId: rejected.operationId, expectedUserId: owner, cancelIfMissing: true })).code, 'LIMIT_REACHED')
        assert.deepEqual(await snapshot(), prior)
      })
      await check('missing account preserves public AUTH_REQUIRED and does not write', async () => {
        await db.$executeRawUnsafe('DELETE FROM "User" WHERE id=$1', owner)
        await assert.rejects(mutations.createPromaneWorkspaceOperation(owner, body()), error => error.code === 'AUTH_REQUIRED')
        await assert.rejects(auth.getOrCreateWorkspace(owner), /Promane account not found/)
        assert.equal((await snapshot()).workspaces, 0)
      })
      await check('two simultaneous first setups converge on one workspace and owner membership', async () => {
        const started = deferred(), release = deferred()
        let entered = 0
        const proxy = { $transaction: (work, options) => db.$transaction(async tx => {
          if (++entered === 2) { started.resolve(); release.resolve() }
          await release.promise
          return work(tx)
        }, options) }
        const first = candidateWithPrisma(proxy).first
        const attempts = [settle(first.getOrCreateWorkspace(owner)), settle(first.getOrCreateWorkspace(owner))]
        try { await bounded(started.promise, 'both first-setup transactions entered') } finally { release.resolve() }
        const results = await Promise.all(attempts)
        assert(results.every(result => result.ok), results.map(result => result.error?.message).join('; '))
        assert.equal(results[0].value.id, results[1].value.id)
        assert.equal(await db.promaneWorkspace.count(), 1)
        assert.equal(await db.promaneMember.count(), 1)
        assert.equal(await db.systemSetting.count(), 0)
      })
      for (const first of ['cancel', 'create']) {
        await check(first + '-first missing cancellation and create serialize on the User row', async () => {
          const entered = deferred(), release = deferred(), request = body()
          const intent = { mode: 'create', workspaceId: null, operationId: request.operationId, expectedUserId: owner, cancelIfMissing: true }
          let holderPid
          const held = settle(db.$transaction(async tx => {
            holderPid = (await tx.$queryRawUnsafe('SELECT pg_backend_pid() AS pid'))[0].pid
            const writer = candidateWithPrisma({ $transaction: work => work(tx) }).explicit
            const value = first === 'cancel'
              ? await writer.recoverPromaneWorkspaceMutation(owner, intent)
              : await writer.createPromaneWorkspaceOperation(owner, request)
            assert.equal(value.state, first === 'cancel' ? 'cancelled' : 'saved')
            entered.resolve()
            await release.promise
          }, { isolationLevel: 'Serializable', timeout: 30000 }))
          await waitForStarted(entered, held)
          const waiting = settle(first === 'cancel'
            ? mutations.createPromaneWorkspaceOperation(owner, request)
            : mutations.recoverPromaneWorkspaceMutation(owner, intent))
          try { await waitForUserRowLock(holderPid, first + '-first cancel/create') } finally { release.resolve() }
          const [winner, follower] = await Promise.all([held, waiting])
          assert.equal(winner.ok, true, winner.error?.message)
          if (first === 'cancel') {
            assert.equal(follower.ok, false)
            assert.match(follower.error.message, /取り消/)
            assert.equal(await db.promaneWorkspace.count(), 0)
            assert.equal(await db.promaneMember.count(), 0)
          } else {
            assert.equal(follower.ok, true, follower.error?.message)
            assert.equal(follower.value.state, 'saved')
            assert.equal(await db.promaneWorkspace.count(), 1)
            assert.equal(await db.promaneMember.count(), 1)
          }
          assert.equal((await snapshot()).promaneReceipts, 1)
        })
      }
      for (const mode of ['first', 'explicit']) {
        await check(mode + ': retirement reservation holds User lock until queued creator rejects', async () => {
          const entered = deferred(), release = deferred()
          let holderPid
          const reserving = settle(db.$transaction(async tx => {
            holderPid = (await tx.$queryRawUnsafe('SELECT pg_backend_pid() AS pid'))[0].pid
            const identity = { operator: { kind: 'admin', id: 'synthetic_admin' }, targetUserId: owner, operationId: crypto.randomUUID(), kind: 'retirement' }
            await store.reserveLifecycleOperation({ $transaction: work => work(tx) }, identity, digest)
            entered.resolve()
            await release.promise
          }, { isolationLevel: 'Serializable', timeout: 30000 }))
          await waitForStarted(entered, reserving)
          const counted = { attempts: 0, errors: [] }
          const proxy = { $transaction: async (work, options) => {
            counted.attempts++
            try { return await db.$transaction(work, options) }
            catch (error) { counted.errors.push({ code: error.code, sqlstate: error.meta?.code }); throw error }
          } }
          const writer = candidateWithPrisma(proxy)
          const pending = settle(mode === 'first' ? writer.first.getOrCreateWorkspace(owner) : writer.explicit.createPromaneWorkspaceOperation(owner, body()))
          try { await waitForUserRowLock(holderPid, mode + ' retirement-first') } finally { release.resolve() }
          const held = await reserving, result = await pending
          assert.equal(held.ok, true, held.error?.message)
          assert.equal(result.ok, false)
          assert.equal(result.error.code, 'ACCOUNT_RETIREMENT_IN_PROGRESS')
          assert(counted.attempts >= 2, 'Serializable waiter must retry with a fresh transaction snapshot')
          assert(counted.errors.some(error => error.code === 'P2034' || error.code === 'P2010' && error.sqlstate === '40001'))
          assert.equal((await snapshot()).workspaces, 0)
          assert.equal((await snapshot()).members, 0)
          assert.equal((await snapshot()).promaneReceipts, 0)
        })
        await check(mode + ': creator holds User lock and actual retirement preflight sees committed Promane history', async () => {
          const entered = deferred(), release = deferred()
          let holderPid
          const creating = settle(db.$transaction(async tx => {
            holderPid = (await tx.$queryRawUnsafe('SELECT pg_backend_pid() AS pid'))[0].pid
            const proxy = { $transaction: work => work(tx) }
            const writer = candidateWithPrisma(proxy)
            const value = mode === 'first' ? await writer.first.getOrCreateWorkspace(owner) : await writer.explicit.createPromaneWorkspaceOperation(owner, body())
            assert(value?.id || value?.entry?.id)
            entered.resolve()
            await release.promise
          }, { isolationLevel: 'Serializable', timeout: 30000 }))
          await waitForStarted(entered, creating)
          const preflight = settle(retirement.checkAccountRetirementSafe(db, owner))
          try { await waitForUserRowLock(holderPid, mode + ' creator-first') } finally { release.resolve() }
          const held = await creating, result = await preflight
          assert.equal(held.ok, true, held.error?.message)
          assert.equal(result.ok, false)
          assert.equal(result.error.reason, 'promane_history')
          assert.equal((await snapshot()).workspaces, 1)
          assert.equal((await snapshot()).members, 1)
        })
      }
    }
    const manifestPath = 'scripts/security-regression/fixtures/promane-r1-46a9/manifest.json'
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    const source = [...Object.keys(manifest.entries), manifestPath, base + 'verify-promane-retirement-create-postgres.cjs']
    const sourcePath = file => before && manifest.entries[file]?.source === 'pinned' ? manifest.entries[file].dataPath : file
    if (before) {
      assert.equal(manifest.baseCommit, '46a9e4fc4a93f49fa3cd2157252aa6cf5ee69006')
      for (const [file, entry] of Object.entries(manifest.entries)) {
        const stable = sourcePath(file)
        assert.equal(crypto.createHash('sha256').update(fs.readFileSync(stable)).digest('hex'), entry.sha256, 'Exact base input: ' + file)
        if (entry.source === 'pinned') assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(process.env.DOYA_TEST_BASELINE, file))).digest('hex'), entry.sha256, 'Materialized base input: ' + file)
      }
    }
    const sourceHashes = Object.fromEntries(source.map(file => [sourcePath(file), crypto.createHash('sha256').update(fs.readFileSync(sourcePath(file))).digest('hex')]))
    const expected = before ? 2 : 18
    assert.equal(observed.length + cases.length, expected)
    if (!before) assert.equal(lockWaitEvidence.length, 6)
    const report = { checkedAt: new Date().toISOString(), expected, passed: observed.length + cases.length, phase: before ? 'before_gap_observed' : 'after_guard_verified', baseCommit: before ? manifest.baseCommit : null, observed, cases, sourceHashes,
      lockWaitEvidence, scope: 'Actual current Promane creators, lifecycle retirement reserve and actual preflight on owned Unix PostgreSQL, synthetic actor, no external provider/DB/send. Six actual User lock waits across retirement and cancel/create orderings, plus first-setup concurrency and read/replay/malformed controls. Full HTTP matrix and other Promane writers remain pending.' }
    fs.writeFileSync(process.env.DOYA_PROMANE_R1_EVIDENCE || base + 'promane-retirement-create-postgres-results.json', JSON.stringify(report, null, 2) + '\n')
    console.log(JSON.stringify(report))
  } finally { await db.$disconnect() }
})().catch(error => { console.error(error); process.exitCode = 1 })
