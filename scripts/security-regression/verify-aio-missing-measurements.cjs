const assert = require('node:assert/strict');
const { load, check } = require('./load-typescript.cjs');
function fixture(options = {}) {
  const state = { scans: [], rows: [] };
  const scan = load('src/lib/aio/scan.ts', {
    '@seo/lib/gemini': { geminiGenerateJson: async () => { throw Error('offline'); } },
    './engines': {
      askEngine: async (engine, prompt) => {
        if (options.allFail || engine === options.failEngine || prompt === options.failPrompt) throw Error('private provider error');
        return { text: options.empty ? '  ' : 'Synthetic answer', citations: [] };
      },
      serperSearch: async () => [], domainOf: () => '',
    },
    './analyze': { analyzeAnswer: async () => {
      if (options.analysisFail) throw Error('private analysis error');
      return { brandMentioned: !options.negative, brandRank: null, sentiment: null, competitors: [], citations: [] };
    } },
  });
  const db = {
    aioMember: { findMany: async () => [{ userId: 'owner' }] },
    user: { findUnique: async () => ({ plan: 'PRO' }) },
    aioBrandProfile: { findUnique: async () => ({ brandName: 'Synthetic', aliases: [], competitors: [] }) },
    aioPrompt: { findMany: async () => [{ id: 'p1', text: 'question1' }, { id: 'p2', text: 'question2' }] },
    aioScan: {
      count: async () => 0,
      findFirst: async () => null,
      create: async ({ data }) => { const row = { id: 's1', ...data }; state.scans.push(row); return row; },
      updateMany: async ({ where, data }) => {
        if (where.updatedAt?.lt) return { count: 0 };
        if (!state.scans.length) return { count: 0 };
        Object.assign(state.scans[0], data); return { count: 1 };
      },
    },
    aioResult: { createMany: async ({ data }) => { state.rows.push(...data); return { count: data.length }; } },
  };
  db.$queryRaw = async () => [{ id: 'synthetic' }];
  db.$transaction = async fn => fn(db);
  const runner = load('src/lib/aio/run.ts', {
    '@/lib/prisma': { prisma: db },
    '@/lib/aio/types': { availableEngines: () => ['gemini', 'chatgpt'], SCAN_STALE_MS: 300000 },
    '@/lib/aio/scan': scan,
    '@/lib/aio/billing': load('src/lib/aio/billing.ts'),
    '@/lib/aio/quota': { scanQuota: () => ({ paid: true, since: new Date(0), limit: 30 }) },
  });
  return { state, run: () => runner.runAndPersistScan('synthetic', { repetitions: 2 }) };
}
(async () => {
  for (const [label, options] of [['all provider failures', { allFail: true }], ['blank answers', { empty: true }], ['analysis failures', { analysisFail: true }]]) {
    await check(label + ' fail without zero score or fabricated observations', async () => {
      const f = fixture(options), result = await f.run();
      assert.equal(result.status, 'failed'); assert.equal(result.summary, undefined);
      assert.equal(f.state.rows.length, 0); assert.equal(f.state.scans[0].awarenessPct, undefined);
      assert(!result.error.includes('private'));
    });
  }
  await check('one failed engine cannot halve measured awareness', async () => {
    const f = fixture({ failEngine: 'chatgpt' }), r = await f.run();
    assert.equal(r.status, 'done'); assert.equal(r.summary.awarenessPct, 100);
    assert.equal(r.summary.totalRuns, 4); assert.equal(f.state.rows.length, 4);
    assert.equal(r.summary.coverage.attempted, 8); assert.equal(r.summary.coverage.failed, 4);
    assert.equal(r.summary.perEngine.find(e => e.engine === 'chatgpt').awarenessPct, null);
    assert.equal(r.summary.coverage.failures.length, 4);
    assert(f.state.rows.every(r => r.answerText));
    assert.equal(f.state.scans[0].summary.coverage.succeeded, 4);
  });
  await check('failed prompt stays unmeasured, other prompt remains measured', async () => {
    const r = await fixture({ failPrompt: 'question2' }).run();
    assert.equal(r.summary.awarenessPct, 100);
    assert(r.summary.promptBreakdown.find(p => p.promptId === 'p2').perEngine.every(e => e.total === 0));
    assert.equal(r.summary.promptBreakdown.find(p => p.promptId === 'p2').samples.length, 0);
  });
  await check('real nonmentions remain a successful zero score', async () => {
    const r = await fixture({ negative: true }).run();
    assert.equal(r.status, 'done'); assert.equal(r.summary.awarenessPct, 0);
    assert.equal(r.summary.coverage.failed, 0); assert.equal(r.summary.totalRuns, 8);
  });
  await check('all successful observations retain complete coverage', async () => {
    const r = await fixture().run();
    assert.equal(r.summary.awarenessPct, 100); assert.equal(r.summary.coverage.succeeded, 8);
    assert.equal(r.summary.coverage.failed, 0);
  });
})().catch(e => { console.error(e); process.exitCode = 1; });
