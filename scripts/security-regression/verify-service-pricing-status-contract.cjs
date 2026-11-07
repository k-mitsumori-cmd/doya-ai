// Synthetic boundaries only; execute the actual route and canonical classification modules.
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert/strict'), crypto = require('crypto');
const root = process.cwd(), ts = require(path.join(root, 'node_modules/typescript'));
const verifier = 'scripts/security-regression/verify-service-pricing-status-contract.cjs';
assert.equal(fs.realpathSync(__filename), fs.realpathSync(path.join(root, verifier)));
const observed = new Set(), results = [];
let enabled, session, user, authFailure, dbFailure, reads, modules, errors;
function load(file) {
  if (modules.has(file)) return modules.get(file);
  observed.add(file);
  const exports = {}; modules.set(file, exports);
  const js = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(js, { exports, process: { env: {} }, Set,
    console: { error: () => { errors++; } },
    require: name => {
      if (name === 'next/server') return { NextResponse: { json: (data, init) => Response.json(data, init) } };
      if (name === 'next-auth') return { getServerSession: async () => { if (authFailure) throw Error('synthetic auth unavailable'); return session; } };
      if (name === '@/lib/auth') return { authOptions: {} };
      if (name === '@/lib/pricing-v2/rollout' || name === './rollout') return { isNewPricingEnabledFor: () => enabled };
      if (name === './prices') return { newPricingPriceIds: () => new Set(['price_team_synthetic']) };
      if (name === '@/lib/prisma') return { prisma: { user: { findUnique: async input => {
        reads++; assert.deepEqual(JSON.parse(JSON.stringify(input)), { where: { email: 'member@example.invalid' }, select: { plan: true, stripePriceId: true } });
        if (dbFailure) throw Error('synthetic read unavailable'); return user;
      } } } };
      const known = { '@/lib/pricing-v2/view.server': 'src/lib/pricing-v2/view.server.ts', './view': 'src/lib/pricing-v2/view.ts', '@/lib/unified-plan': 'src/lib/unified-plan.ts' };
      if (known[name]) return load(known[name]);
      throw Error('Unapproved dependency: ' + name);
    },
  }, { filename: file });
  return exports;
}
async function test(name, setup, expected, expectedReads, status = 200) {
  enabled = true; session = { user: { email: 'member@example.invalid' } }; user = { plan: 'FREE', stripePriceId: null };
  authFailure = false; dbFailure = false; reads = 0; errors = 0; modules = new Map(); setup();
  try {
    const response = await load('src/app/api/pricing/status/route.ts').GET();
    assert.equal(response.status, status); assert.deepEqual(await response.json(), expected);
    assert.equal(response.headers.get('cache-control'), 'private, no-store'); assert.equal(response.headers.get('vary'), 'Cookie');
    assert.equal(reads, expectedReads); assert.equal(errors > 0, status === 503);
    results.push({ name, passed: true });
  } catch (e) { results.push({ name, passed: false, error: e.message }); }
}
(async () => {
  await test('rollout off does not query plan', () => { enabled = false; dbFailure = true; }, { newPricing: false, pricingView: 'current' }, 0);
  await test('anonymous enabled is new without plan query', () => { session = null; }, { newPricing: true, pricingView: 'new' }, 0);
  await test('free user is new', () => {}, { newPricing: true, pricingView: 'new' }, 1);
  await test('missing user is new', () => { user = null; }, { newPricing: true, pricingView: 'new' }, 1);
  for (const plan of ['PRO', 'LIGHT', 'ENTERPRISE']) await test('protected legacy ' + plan, () => { user = { plan, stripePriceId: 'price_old_synthetic' }; }, { newPricing: true, pricingView: 'legacy' }, 1);
  await test('manual paid grant stays legacy', () => { user = { plan: 'PRO', stripePriceId: null }; }, { newPricing: true, pricingView: 'legacy' }, 1);
  await test('PRO with team price is team', () => { user = { plan: 'PRO', stripePriceId: 'price_team_synthetic' }; }, { newPricing: true, pricingView: 'team' }, 1);
  await test('team price alone cannot grant a paid plan', () => { user = { plan: 'FREE', stripePriceId: 'price_team_synthetic' }; }, { newPricing: true, pricingView: 'new' }, 1);
  await test('failed DB classification is unavailable', () => { dbFailure = true; }, { error: 'PRICING_STATUS_UNAVAILABLE' }, 1, 503);
  await test('failed session is not anonymous pricing authorization', () => { authFailure = true; }, { error: 'PRICING_STATUS_UNAVAILABLE' }, 0, 503);
  assert.equal(results.length, 12);
  const sourceBindings = Object.fromEntries([...observed, verifier].map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex')]));
  const report = { marker: 'service-pricing-status-contract', checkedAt: new Date().toISOString(), conditions: results.length, passed: results.filter(r => r.passed).length, failed: results.filter(r => !r.passed).length, results, sourceBindings, scope: 'Actual GET/canonical resolver/subscriber-kind/paid-plan modules. Synthetic session, rollout, configured price IDs and read-only Prisma boundary. All unapproved imports throw; no production auth, DB, Stripe or financial acceptance.' };
  if (process.env.SERVICE_PRICING_STATUS_OUTPUT) fs.writeFileSync(process.env.SERVICE_PRICING_STATUS_OUTPUT, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify(report)); if (report.failed) process.exitCode = 1;
})().catch(e => { console.error(e); process.exitCode = 1; });
