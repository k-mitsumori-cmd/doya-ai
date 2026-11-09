const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const { root, seatSourcePath, evidenceDir } = require('./seat-regression-support.cjs'), { load: rawLoad } = require('./load-typescript.cjs');
const privateEnv = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')), state = JSON.parse(fs.readFileSync(process.argv[3], 'utf8')), url = new URL(privateEnv.DATABASE_URL);
assert(['localhost', '127.0.0.1'].includes(url.hostname) && url.searchParams.get('host') === state.socket && state.socket.startsWith('/tmp/doya-') && /^\/doya_seat_models_[0-9]+$/.test(url.pathname));
assert.equal(state.prismaClientPath, path.join(path.dirname(process.argv[3]), 'client'));
const { PrismaClient, Prisma } = require(state.prismaClientPath), db = new PrismaClient({ datasources: { db: { url: privateEnv.DATABASE_URL } } });
const hashes = {}, globals = { Date, process: { env: {} } };
let providerCalls = 0;
const forbidden = () => { providerCalls++; throw Error('No external IO'); };
function load(file, mocks) { hashes[file] = crypto.createHash('sha256').update(fs.readFileSync(seatSourcePath(file))).digest('hex'); return rawLoad(file, mocks, globals); }
const unified = load('src/lib/unified-plan.ts', {}), pricing = load('src/lib/pricing.ts', { './unified-plan': unified }), planUtils = load('src/lib/plan-utils.ts', {}), stripeModule = load('src/lib/stripe.ts', { stripe: class {
    }, 'node:crypto': crypto }), manual = load('src/lib/billing-manual-grants.ts', { '@/lib/prisma': { prisma: db } }), sync = load('src/lib/billing-sync.ts', { '@/lib/prisma': { prisma: db, withRetry: fn => fn() }, '@/lib/stripe': stripeModule, '@/lib/billing-manual-grants': manual });
let authorized = true, serializationFailures = 0, serializationAttempts = 0;
// Throw inside a real transaction so injected serialization failures roll back SQL.
const routeDb = new Proxy(db, { get(target, key) {
  if (key === '$transaction') return async (callback, options) => {
    serializationAttempts++;
    return target.$transaction(async tx => {
      const result = await callback(tx);
      if (serializationFailures > 0) {
        serializationFailures--;
        const error = new Error('Synthetic serialization failure');
        error.code = 'P2034';
        throw error;
      }
      return result;
    }, options);
  };
  return Reflect.get(target, key, target);
} });
const route = load('src/app/api/admin/users/route.ts', { 'next/server': { NextResponse: { json: (b, i) => Response.json(b, i) } }, 'next/headers': { cookies: async () => ({ get: () => ({ value: 'synthetic-admin-cookie' }) }) }, '@/lib/admin-auth': { COOKIE_NAME: 'admin', verifyAdminSession: async () => ({ valid: authorized }) }, '@/lib/stripe': { ...stripeModule, findActiveLikeSubscriptions: forbidden, isDoyaSubscriptionOwnedByUser: forbidden }, '@/lib/billing-sync': sync, '@/lib/prisma': { prisma: routeDb, withRetry: fn => fn() }, '@/lib/admin/banner-quota': { summarizeBannerMonthlyQuota: forbidden }, '@/lib/pricing': pricing, '@/lib/seo-article-admission': { getSeoArticleMonthlyUsageForUsers: forbidden }, '@/lib/plan-utils': planUtils, '@/lib/admin/contract-price': { summarizeAdminContractPrice: forbidden }, stripe: class {
        constructor() { this.subscriptions = { retrieve: forbidden, cancel: forbidden }; }
    } });
const rows = [];
let completed = false, failedCase = null;
const invalid = [['negative monthly', { setMonthlyUsage: -1 }], ['negative daily', { setDailyUsage: -1 }], ['fraction', { setMonthlyUsage: 1.5 }], ['overflow', { setDailyUsage: 2147483648 }], ['numeric string', { setMonthlyUsage: '3' }], ['null counter', { setMonthlyUsage: null }], ['null service', { serviceId: null }], ['array service', { serviceId: ['banner'] }], ['object service', { serviceId: { id: 'banner' } }], ['empty service', { serviceId: '' }], ['array user', { userId: ['x'] }], ['blank user', { userId: ' ' }], ['string reset', { resetMonthlyUsage: 'false' }], ['numeric reset', { resetDailyUsage: 0 }], ['reset without service', { serviceId: undefined, resetMonthlyUsage: true }], ['counter without service', { serviceId: undefined, setMonthlyUsage: 0 }], ['null plan', { plan: null }], ['bad legacy plan', { servicePlan: 'INVALID' }], ['conflicting plans', { servicePlan: 'FREE' }], ['bad role', { role: 'OWNER' }], ['array body', null], ['malformed json', null]];
async function seed(i) { const id = 'synthetic-admin-matrix-' + i; await db.user.create({ data: { id, email: id + '@example.invalid', plan: 'FREE', role: 'USER' } }); for (const serviceId of ['banner', 'writing'])
    await db.userServiceSubscription.create({ data: { userId: id, serviceId, plan: 'FREE', monthlyUsage: 5, dailyUsage: 2, lastUsageReset: new Date() } }); return id; }
async function request(id, patch, raw) { return route.PATCH(new Request('https://synthetic.invalid/api/admin/users', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: raw ?? JSON.stringify({ userId: id, serviceId: 'banner', plan: 'PRO', role: 'ADMIN', ...patch }) })); }
async function untouched(id) { const user = await db.user.findUnique({ where: { id } }); assert.equal(user.plan, 'FREE'); assert.equal(user.role, 'USER'); const subs = await db.userServiceSubscription.findMany({ where: { userId: id } }); assert.equal(subs.length, 2); assert(subs.every(s => s.plan === 'FREE' && s.monthlyUsage === 5 && s.dailyUsage === 2)); }
(async () => { try {
    for (const [i, [name, patch]] of invalid.entries()) {
        failedCase = name;
        const id = await seed(i), raw = name === 'array body' ? '[]' : name === 'malformed json' ? '{' : undefined;
        const response = await request(id, patch, raw);
        assert.equal(response.status, 400, name);
        await untouched(id);
        rows.push({ name, passed: true });
    }
    for (const [i, patch] of [{ setMonthlyUsage: 0 }, { setDailyUsage: 2147483647 }].entries()) {
        failedCase = 'valid integer boundary ' + i;
        const id = await seed(100 + i), response = await request(id, patch);
        assert.equal(response.status, 200);
        const sub = await db.userServiceSubscription.findUnique({ where: { userId_serviceId: { userId: id, serviceId: 'banner' } } });
        assert.equal(sub.monthlyUsage, patch.setMonthlyUsage ?? 5);
        assert.equal(sub.dailyUsage, patch.setDailyUsage ?? 2);
        assert.equal((await db.user.findUnique({ where: { id } })).plan, 'PRO');
        rows.push({ name: failedCase, passed: true });
    }
    failedCase = 'legacy servicePlan and writing reset remain supported';
    {
        const id = await seed(200), response = await request(id, { plan: undefined, role: undefined, serviceId: 'writing', servicePlan: 'PRO', resetDailyUsage: true });
        assert.equal(response.status, 200);
        const user = await db.user.findUnique({ where: { id } });
        assert.equal(user.plan, 'PRO');
        assert.equal(user.role, 'USER');
        const sub = await db.userServiceSubscription.findUnique({ where: { userId_serviceId: { userId: id, serviceId: 'writing' } } });
        assert.equal(sub.dailyUsage, 0);
        assert.equal(sub.monthlyUsage, 5);
        rows.push({ name: failedCase, passed: true });
    }
    failedCase = 'authentication rejection precedes input handling';
    {
        const id = await seed(300);
        authorized = false;
        assert.equal((await request(id, { setMonthlyUsage: -1 })).status, 401);
        await untouched(id);
        rows.push({ name: failedCase, passed: true });
        authorized = true;
    }
    assert.equal(rows.length, 26); // Preserve the original validation/authentication matrix.
    await db.$executeRawUnsafe(`CREATE FUNCTION audit_reject_usage() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."monthlyUsage" = 12345 THEN RAISE EXCEPTION 'synthetic usage write failure'; END IF; RETURN NEW; END $$`);
    await db.$executeRawUnsafe(`CREATE TRIGGER audit_reject_usage BEFORE UPDATE ON "UserServiceSubscription" FOR EACH ROW EXECUTE FUNCTION audit_reject_usage()`);
    const changes = [
      { plan: 'PRO', setMonthlyUsage: 12345 },
      { role: 'ADMIN', setMonthlyUsage: 12345 },
      { servicePlan: 'BUNDLE', setMonthlyUsage: 12345 },
    ];
    for (const [i, patch] of changes.entries()) {
      failedCase = 'database failure rolls back plan/role/legacy change ' + i;
      const id = await seed(400 + i);
      assert.equal((await request(id, { plan: undefined, role: undefined, ...patch })).status, 500);
      await untouched(id);
      rows.push({ name: failedCase, passed: true });
    }
    await db.$executeRawUnsafe('DROP TRIGGER audit_reject_usage ON "UserServiceSubscription"');
    for (const [i, patch] of changes.entries()) {
      failedCase = 'successful combined change returns committed snapshot ' + i;
      const id = await seed(500 + i), response = await request(id, { plan: undefined, role: undefined, ...patch });
      assert.equal(response.status, 200);
      const result = await response.json();
      assert.equal(result.plan, patch.plan ?? patch.servicePlan ?? 'FREE');
      assert.equal(result.role, patch.role ?? 'USER');
      assert.equal(result.serviceSubscriptions.find(s => s.serviceId === 'banner').monthlyUsage, 12345);
      const persisted = await db.userServiceSubscription.findUnique({ where: { userId_serviceId: { userId: id, serviceId: 'banner' } } });
      assert.equal(persisted.monthlyUsage, 12345);
      rows.push({ name: failedCase, passed: true });
    }
    failedCase = 'serialization retry rolls back then commits the complete update';
    {
      const id = await seed(600), before = serializationAttempts;
      serializationFailures = 1;
      assert.equal((await request(id, { setMonthlyUsage: 9 })).status, 200);
      assert.equal(serializationAttempts - before, 2);
      const user = await db.user.findUnique({ where: { id } });
      assert.equal(user.plan, 'PRO'); assert.equal(user.role, 'ADMIN');
      const sub = await db.userServiceSubscription.findUnique({ where: { userId_serviceId: { userId: id, serviceId: 'banner' } } });
      assert.equal(sub.monthlyUsage, 9);
      rows.push({ name: failedCase, passed: true });
    }
    failedCase = 'serialization exhaustion leaves all prior state unchanged';
    {
      const id = await seed(601), before = serializationAttempts;
      serializationFailures = 3;
      assert.equal((await request(id, { setMonthlyUsage: 9 })).status, 500);
      assert.equal(serializationAttempts - before, 3);
      await untouched(id);
      rows.push({ name: failedCase, passed: true });
    }
    assert.equal(rows.length, 34);
    assert.equal(providerCalls, 0);
    completed = true;
    failedCase = null;
}
finally {
    fs.writeFileSync(evidenceDir + '/admin-user-input-results.json', JSON.stringify({ checkedAt: new Date().toISOString(), completed, count: rows.length, rows, failedCase, sourceHashes: hashes, actualRouteAndBillingSync: true, realPrivateSql: true, syntheticAdminAuthentication: true, syntheticRetryBoundary: true, realProviderRequests: providerCalls, productionWrites: 0, wholeAuditComplete: false }, null, 2) + String.fromCharCode(10));
    await db.$disconnect();
} })().catch(e => { console.error(e.message); process.exitCode = 1; });
