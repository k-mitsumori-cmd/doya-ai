const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');
(async () => {
  let passed = 0;
  for (const service of ['doyaslide', 'cunning']) {
    for (const mode of ['guest', 'authenticated', 'failure']) {
      let reads = 0;
      const limits = service === 'doyaslide' ? {
        getUserTier: async () => { reads++; return 'PRO'; },
        getUserDoyaSlideLimits: async () => ({ monthlySlides: 100 }),
        countProjects: async () => 2,
        getMonthlyUsage: async () => 3,
      } : { getCunningUsage: async () => { reads++; return { tier: 'PRO', used: 3 }; } };
      const route = load(`src/app/api/${service}/usage/route.ts`, {
        'next/server': { NextResponse: { json: (data, init) => Response.json(data, init) } },
        [`@/lib/${service}/access`]: { getUserId: async () => {
          if (mode === 'failure') throw Error('SYNTHETIC_PRIVATE');
          return mode === 'guest' ? null : 'synthetic-actor';
        } },
        [`@/lib/${service}/limits`]: limits,
      });
      const response = await route.GET();
      assert.equal(response.headers.get('cache-control'), 'private, no-store');
      assert.equal(response.headers.get('vary'), 'Cookie');
      assert.equal(response.status, mode === 'failure' ? 503 : 200);
      const data = await response.json();
      assert.ok(!JSON.stringify(data).includes('SYNTHETIC_PRIVATE'));
      if (mode === 'failure') assert.equal(data.plan, undefined);
      else assert.equal(data.plan, mode === 'guest' ? 'GUEST' : 'PRO');
      assert.equal(reads, mode === 'authenticated' ? 1 : 0);
      passed++;
    }
  }
  console.log(JSON.stringify({ passed, scope: 'Actual two usage GET handlers; synthetic auth and read-only limits; guest/auth/failure cache isolation and sanitized errors; no database or provider calls.' }));
})().catch(error => { console.error(error); process.exitCode = 1; });
