const { root: seatRepo, seatSourcePath, evidenceDir } = require('./seat-regression-support.cjs');
const fs = require('node:fs'), assert = require('node:assert/strict');
const path = require('node:path'), crypto = require('node:crypto');
const repo = seatRepo;
const { load } = require(repo + '/scripts/security-regression/load-typescript.cjs');
const team = load('src/lib/pricing-v2/team.ts', { './plans': load('src/lib/pricing-v2/plans.ts') });
const core = load('src/lib/pricing-v2/seat-operation.ts', { 'node:crypto': crypto, '@/lib/prisma': { prisma: null }, './team': team });
const { PrismaClient } = require(repo + '/node_modules/@prisma/client');
const privateEnv = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')), privateState = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
const url = privateEnv.DATABASE_URL, parsed = new URL(url);
assert(parsed.searchParams.get('host') === privateState.socket && privateState.socket.startsWith('/tmp/doya-'));
assert(['localhost', '127.0.0.1'].includes(parsed.hostname));
const raw = new PrismaClient({ datasources: { db: { url } } });
const schema = 'seat_coordination_' + process.pid;
const setting = '"' + schema + '"."settings"', cache = '"' + schema + '"."cache"', members = '"' + schema + '"."members"';
const result = { seats: 3, used: 3, monthly: 18740, points: 2400, addedPoints: 0 };
const request = { subscriptionId: 'sub_synthetic', seatItemId: 'si_synthetic', from: 5, to: 3, direction: 'down', interval: 'month', used: 3, status: 'active', grantPoints: false, pointsAt: 1800000000000 };
const now = 1800000000000, company = 'synthetic-company', operation = 'synthetic-operation-0001';
const rowKey = 'team-seat-operation:v1:' + company;
const db = { $transaction: (fn, options) => raw.$transaction(async tx => {
  const systemSetting = {
    findUnique: async ({ where }) => (await tx.$queryRawUnsafe('SELECT value FROM ' + setting + ' WHERE key=$1', where.key))[0] || null,
    upsert: async ({ create }) => { await tx.$executeRawUnsafe('INSERT INTO ' + setting + ' (key,value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=excluded.value', create.key, create.value); return create; },
    create: async ({ data }) => { await tx.$executeRawUnsafe('INSERT INTO ' + setting + ' (key,value) VALUES ($1,$2)', data.key, data.value); return data; },
  };
  return fn({ systemSetting, $executeRaw: tx.$executeRaw.bind(tx), $executeRawUnsafe: tx.$executeRawUnsafe.bind(tx), $queryRawUnsafe: tx.$queryRawUnsafe.bind(tx) });
}, options) };
const cases = [];
async function check(name, fn) { await fn(); cases.push(name); console.log('PASS seat coordination SQL: ' + name); }
async function rejectsCode(promise, code) { let error; try { await promise; } catch (e) { error = e; } assert(error, code); assert.equal(error.code, code); }
async function reset() { await raw.$executeRawUnsafe('DELETE FROM ' + setting); await raw.$executeRawUnsafe('UPDATE ' + cache + ' SET seats=5'); await raw.$executeRawUnsafe('DELETE FROM ' + members); }
async function readState() { return JSON.parse((await raw.$queryRawUnsafe('SELECT value FROM ' + setting + ' WHERE key=$1', rowKey))[0].value); }
const claim = async (at = now, op = operation, seats = 3) => { const s = await core.beginSeatOperation(company, op, seats, db, at); assert.equal(s.kind, 'claimed'); return s.claim; };
const mark = async c => core.recordSeatStripeAttempt(c, request, db, now + 1);
const saveCache = tx => tx.$executeRawUnsafe('UPDATE ' + cache + ' SET seats=3');
const countMembers = async () => Number((await raw.$queryRawUnsafe('SELECT count(*) AS n FROM ' + members))[0].n);
(async () => {
  let created = false;
  try {
    await raw.$executeRawUnsafe('CREATE SCHEMA "' + schema + '"'); created = true;
    await raw.$executeRawUnsafe('CREATE TABLE ' + setting + ' (key text PRIMARY KEY,value text NOT NULL)');
    await raw.$executeRawUnsafe('CREATE TABLE ' + cache + ' (seats integer NOT NULL)');
    await raw.$executeRawUnsafe('INSERT INTO ' + cache + ' VALUES (5)');
    await raw.$executeRawUnsafe('CREATE TABLE ' + members + ' (email text PRIMARY KEY)');
    await check('idle-admission-commits-once', async () => {
      await core.withSeatAdmission(company, tx => tx.$executeRawUnsafe('INSERT INTO ' + members + ' VALUES ($1)', 'synthetic@example.invalid'), db);
      assert.equal(await countMembers(), 1); assert.equal((await readState()).revision, 1);
    });
    await reset();
    let c = await claim();
    await check('preparation-blocks-admission-before-callback', async () => {
      let invoked = false; await rejectsCode(core.withSeatAdmission(company, async () => { invoked = true; }, db), 'SEAT_OPERATION_BUSY'); assert.equal(invoked, false);
    });
    await check('active-duplicate-and-different-operations-blocked', async () => {
      await rejectsCode(core.beginSeatOperation(company, operation, 3, db, now + 1), 'SEAT_OPERATION_BUSY');
      await rejectsCode(core.beginSeatOperation(company, 'synthetic-operation-0002', 4, db, now + 1), 'SEAT_OPERATION_BUSY');
    });
    await check('preparation-cancellation-unblocks', async () => { await core.cancelSeatPreparation(c, db); await core.withSeatAdmission(company, async () => {}, db); });
    await reset(); c = await claim();
    await check('expired-preparation-token-cannot-start-stripe', async () => {
      const replacement = await claim(now + 300001, 'synthetic-operation-0002');
      await rejectsCode(core.recordSeatStripeAttempt(c, request, db, now + 300002), 'SEAT_OPERATION_STALE');
      c = replacement;
    });
    await reset(); c = await claim();
    await check('stripe-request-is-durably-recorded-before-call', async () => {
      c = await mark(c); const stored = await readState(); assert.equal(stored.active.phase, 'stripe'); assert.equal(stored.active.request.to, 3); assert(stored.active.idempotencyKey.startsWith('doya-seat-'));
    });
    await check('unknown-outcome-cannot-cancel-or-admit', async () => {
      await rejectsCode(core.cancelSeatPreparation(c, db), 'SEAT_OPERATION_RECONCILE');
      await rejectsCode(core.withSeatAdmission(company, async () => {}, db), 'SEAT_OPERATION_BUSY');
    });
    await check('expired-stripe-lease-does-not-admit-or-start-other-change', async () => {
      await rejectsCode(core.withSeatAdmission(company, async () => {}, db), 'SEAT_OPERATION_BUSY');
      await rejectsCode(core.beginSeatOperation(company, 'synthetic-operation-0002', 4, db, now + 900000), 'SEAT_OPERATION_BUSY');
    });
    await check('retry-must-keep-same-requested-seats', async () => { await rejectsCode(core.beginSeatOperation(company, operation, 4, db, now + 900000), 'SEAT_OPERATION_BUSY'); });
    const old = c;
    await check('retry-reuses-immutable-stripe-key-and-request', async () => {
      c = await claim(now + 900000); assert.notEqual(c.token, old.token); assert.equal(c.active.idempotencyKey, old.active.idempotencyKey); assert.equal(JSON.stringify(c.active.request), JSON.stringify(old.active.request));
    });
    await check('late-original-worker-cannot-publish-or-unlock', async () => {
      let called = false; await rejectsCode(core.finishSeatOperation(old, result, async () => { called = true; }, db), 'SEAT_OPERATION_STALE'); assert.equal(called, false);
    });
    await check('retry-after-idempotency-safe-window-needs-reconciliation', async () => {
      await rejectsCode(core.beginSeatOperation(company, operation, 3, db, now + 21 * 3600000), 'SEAT_OPERATION_RECONCILE');
      assert.equal((await readState()).active.token, c.token);
    });
    await check('failed-cache-commit-rolls-back-and-keeps-reservation', async () => {
      let failed = false; try { await core.finishSeatOperation(c, result, async tx => { await saveCache(tx); throw Error('SYNTHETIC_SAVE_FAILURE'); }, db); } catch { failed = true; }
      assert(failed); assert.equal((await raw.$queryRawUnsafe('SELECT seats FROM ' + cache))[0].seats, 5); assert.equal((await readState()).active.token, c.token);
      assert.equal((await raw.$queryRawUnsafe('SELECT count(*) AS n FROM ' + setting + ' WHERE key LIKE $1', rowKey + ':result:%'))[0].n, 0n);
    });
    await check('verified-result-cache-receipt-and-unlock-are-atomic', async () => {
      await core.finishSeatOperation(c, result, saveCache, db); assert.equal((await readState()).active, null); assert.equal((await raw.$queryRawUnsafe('SELECT seats FROM ' + cache))[0].seats, 3);
    });
    await check('completed-operation-replays-without-new-mutation', async () => {
      const replay = await core.beginSeatOperation(company, operation, 3, db, now + 2 * 86400000); assert.equal(replay.kind, 'replay'); assert.equal(JSON.stringify(replay.result), JSON.stringify(result)); assert.equal((await readState()).active, null);
    });
    await check('completed-operation-id-cannot-be-reused-for-other-seats', async () => { await rejectsCode(core.beginSeatOperation(company, operation, 4, db, now + 1000000), 'SEAT_OPERATION_CONFLICT'); });
    await reset();
    await check('delayed-get-cannot-overwrite-a-completed-seat-change', async () => {
      const revision = await core.seatCacheRevision(company, db); const pending = await mark(await claim()); await core.finishSeatOperation(pending, result, saveCache, db);
      let called = false; await rejectsCode(core.saveSeatCacheAtRevision(company, revision, async () => { called = true; }, db), 'SEAT_OPERATION_STALE'); assert.equal(called, false);
    });
    await check('second-overlapping-get-cannot-publish-old-revision', async () => {
      const revision = await core.seatCacheRevision(company, db); await core.saveSeatCacheAtRevision(company, revision, async () => {}, db);
      await rejectsCode(core.saveSeatCacheAtRevision(company, revision, async () => {}, db), 'SEAT_OPERATION_STALE');
    });
    await reset(); c = await claim();
    await check('other-company-remains-independent', async () => { await core.withSeatAdmission('synthetic-company-b', async () => {}, db); assert.equal((await readState()).active.token, c.token); });
    await check('get-snapshot-blocked-during-stripe-preparation', async () => { await rejectsCode(core.seatCacheRevision(company, db), 'SEAT_OPERATION_BUSY'); });
    await reset();
    await check('admission-rollback-does-not-leave-member-or-revision', async () => {
      let failed = false; try { await core.withSeatAdmission(company, async tx => { await tx.$executeRawUnsafe('INSERT INTO ' + members + ' VALUES ($1)', 'rollback@example.invalid'); throw Error('SYNTHETIC_ROLLBACK'); }, db); } catch { failed = true; }
      assert(failed); assert.equal(await countMembers(), 0); assert.equal(await core.seatCacheRevision(company, db), 0);
    });
    await check('admission-and-seat-reservation-use-real-shared-advisory-lock', async () => {
      let release, reached; const gate = new Promise(r => { release = r; }), ready = new Promise(r => { reached = r; });
      const admission = core.withSeatAdmission(company, async tx => { reached(); await gate; await tx.$executeRawUnsafe('INSERT INTO ' + members + ' VALUES ($1)', 'ordered@example.invalid'); }, db);
      await ready; const pending = claim(); let waiter = false;
      try {
        const deadline = Date.now() + 3000;
        while (Date.now() < deadline) {
          const rows = await raw.$queryRawUnsafe("SELECT count(*) AS n FROM pg_locks WHERE locktype='advisory' AND NOT granted AND classid=(hashtext('team-seat-operation:v1')::bigint & 4294967295)::oid AND objid=(hashtext($1)::bigint & 4294967295)::oid", company);
          if (rows[0].n > 0n) { waiter = true; break; }
          await new Promise(r => setTimeout(r, 20));
        }
      } finally { release(); }
      await admission; const waitingClaim = await pending;
      assert(waiter, 'SQL advisory lock waiter was not observed'); assert.equal(await countMembers(), 1); assert.equal(waitingClaim.active.phase, 'preparing');
    });
    await reset();
    await check('preparation-cache-refresh-keeps-admissions-blocked', async () => {
      const preparing = await claim();
      await core.saveSeatPreparationCache(preparing, tx => tx.$executeRawUnsafe('UPDATE ' + cache + ' SET seats=5'), db, now + 1);
      assert.equal((await readState()).active.token, preparing.token);
      await rejectsCode(core.withSeatAdmission(company, async () => {}, db), 'SEAT_OPERATION_BUSY');
      await rejectsCode(core.saveSeatPreparationCache(preparing, async () => {}, db, now + 300001), 'SEAT_OPERATION_STALE');
    });
    await reset();
    let rejectedClaim;
    await check('definitive-upgrade-card-rejection-is-durable-and-unlocks', async () => {
      const preparing = await claim(now, operation, 6);
      rejectedClaim = await core.recordSeatStripeAttempt(preparing, { ...request, to: 6, direction: 'up' }, db, now + 1);
      await core.recordSeatPaymentRejection(rejectedClaim, db);
      assert.equal((await readState()).active, null);
      await core.withSeatAdmission(company, async () => {}, db);
    });
    await check('same-rejected-operation-replays-rejection-without-new-attempt', async () => {
      const replay = await core.beginSeatOperation(company, operation, 6, db, now + 1000);
      assert.equal(replay.kind, 'rejected'); assert.equal(replay.code, 'PAYMENT_FAILED'); assert.equal((await readState()).active, null);
    });
    await check('rejected-id-cannot-authorize-different-quantity', async () => {
      await rejectsCode(core.beginSeatOperation(company, operation, 7, db, now + 1000), 'SEAT_OPERATION_CONFLICT');
    });
    await check('late-rejection-cannot-erase-a-new-operation', async () => {
      const newer = await claim(now + 1000, 'synthetic-operation-0002', 6);
      await rejectsCode(core.recordSeatPaymentRejection(rejectedClaim, db), 'SEAT_OPERATION_STALE');
      assert.equal((await readState()).active.token, newer.token);
    });
    await reset();
    await check('downsize-error-is-not-payment-rejection-proof', async () => {
      const down = await mark(await claim());
      await rejectsCode(core.recordSeatPaymentRejection(down, db), 'SEAT_OPERATION_RECONCILE');
      assert.equal((await readState()).active.token, down.token);
    });
    await reset();
    await check('malformed-durable-state-fails-closed', async () => {
      await raw.$executeRawUnsafe('INSERT INTO ' + setting + ' VALUES ($1,$2)', rowKey, '{"revision":0,"active":{"phase":"unknown"}}');
      let invoked = false, failed = false; try { await core.withSeatAdmission(company, async () => { invoked = true; }, db); } catch { failed = true; }
      assert(failed); assert.equal(invoked, false);
    });
    fs.writeFileSync(evidenceDir + '/core-sql-result.json', JSON.stringify({ checkedAt: new Date().toISOString(), count: cases.length, cases, realOwnedPostgres: true, actualCandidateHelper: true, systemSettingTemporarySqlAdapter: true, deployedPrismaModelNotExercised: true, stripeApiRequests: 0, productionRequests: 0, routeIntegrationComplete: false, candidateSha256: crypto.createHash('sha256').update(fs.readFileSync(seatSourcePath('src/lib/pricing-v2/seat-operation.ts'))).digest('hex') }, null, 2) + '\n');
  } finally {
    if (created) await raw.$executeRawUnsafe('DROP SCHEMA "' + schema + '" CASCADE');
    const rows = await raw.$queryRawUnsafe('SELECT schema_name FROM information_schema.schemata WHERE schema_name=$1', schema); assert.equal(rows.length, 0); await raw.$disconnect();
    fs.writeFileSync(evidenceDir + '/core-sql-cleanup.json', JSON.stringify({ checkedAt: new Date().toISOString(), ownedSchemaRemoved: true, originalApplicationTablesNotWritten: true, connectionClosed: true }, null, 2) + '\n');
  }
})().catch(e => { console.error(JSON.stringify({ completed: false, name: e.name, safeCode: typeof e.code === 'string' ? e.code : null, assertion: e.name === 'AssertionError' ? e.message : undefined })); process.exitCode = 1; });
