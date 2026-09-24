const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');

let clockMs = Date.parse('2026-09-30T15:00:00.000Z');
class FixedDate extends Date {
  constructor(...args) { super(...(args.length ? args : [clockMs])); }
  static now() { return clockMs; }
}
let plan = 'FREE';
let subscription = {
  monthlyUsage: 20,
  lastUsageReset: new Date('2026-09-30T14:59:59.999Z'),
};
let lockTail = Promise.resolve();
const store = {
  findUnique: async () => subscription && structuredClone(subscription),
  create: async ({ data }) => { subscription = { ...data }; return subscription; },
  update: async ({ data }) => {
    const delta = data.monthlyUsage?.decrement;
    subscription = {
      ...subscription,
      ...data,
      monthlyUsage: delta == null ? data.monthlyUsage : subscription.monthlyUsage - delta,
    };
    return subscription;
  },
};
const tx = { $queryRaw: async () => [{ id: 'user' }], userServiceSubscription: store };
const prisma = {
  user: { findUnique: async () => ({ plan }) },
  userServiceSubscription: store,
  $transaction: async (operation) => {
    const previous = lockTail;
    let unlock;
    lockTail = new Promise((resolve) => { unlock = resolve; });
    await previous;
    try { return await operation(tx); }
    finally { unlock(); }
  },
};
const limits = load('src/lib/doyaslide/limits.ts', {
  '@/lib/prisma': { prisma },
  '@/lib/plan-utils': { tierFrom: (value) => value },
}, { Date: FixedDate });

(async () => {
  assert.equal(await limits.getMonthlyUsage('user'), 0, 'JST month rollover must clear displayed usage');
  const results = await Promise.all([
    limits.reserveMonthlySlides('user', 12),
    limits.reserveMonthlySlides('user', 12),
  ]);
  assert.deepEqual(results.map((result) => result.granted), [12, 8]);
  assert.equal(subscription.monthlyUsage, 20, 'parallel reservations cannot exceed the monthly limit');
  assert.equal(subscription.lastUsageReset.toISOString(), '2026-09-30T15:00:00.000Z');
  await limits.releaseMonthlySlides('user', 12, new Date('2026-08-31T15:00:00.000Z'));
  assert.equal(subscription.monthlyUsage, 20, 'previous-month refund cannot consume new-month allowance');
  await limits.releaseMonthlySlides('user', 8, results[1].reservedMonth);
  assert.equal(subscription.monthlyUsage, 12);
  plan = 'ENTERPRISE';
  const unlimited = await limits.reserveMonthlySlides('user', 5);
  assert.equal(unlimited.granted, 5);
  assert.equal(unlimited.reservedMonth, null);
  await limits.releaseMonthlySlides('user', 5, unlimited.reservedMonth);
  assert.equal(subscription.monthlyUsage, 12, 'unlimited plan refunds cannot decrement a prior tracked balance');
  console.log('PASS DoyaSlide monthly quota: JST rollover, concurrent reserve, period-safe refund, unlimited plan');
})().catch((error) => { console.error(error); process.exitCode = 1; });
