const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');

let externalCalls = 0;
let modelCalls = 0;
let providerRows = [];
const operationalJson = load('src/lib/operational-json.ts', {}, { TextDecoder, Uint8Array });
const estimate = load('src/app/api/doyalist/estimate/route.ts', {
  'next/server': { NextResponse: Response },
  'next-auth': { getServerSession: async () => ({ user: { id: 'user' } }) },
  '@/lib/auth': { authOptions: {} },
  '@/lib/doyalist/collect/prefecture-codes': { resolvePrefectureCodes: () => [] },
  '@/lib/operational-json': operationalJson,
  '@/lib/doyalist/collect/provider-json': {
    fetchCollectionJson: async (url, _init, limits) => {
      externalCalls++;
      assert.equal(new URL(url).searchParams.get('name'), '株式会社');
      assert.equal(limits.timeoutMs, 12000);
      assert.equal(limits.maxBytes, 4 * 1024 * 1024);
      return { ok: true, status: 200, data: { 'hojin-infos': providerRows } };
    },
  },
}, {
  process: { env: { GBIZINFO_API_TOKEN: 'test' } },
  AbortSignal,
});
const expand = load('src/app/api/doyalist/expand-keywords/route.ts', {
  'next/server': { NextResponse: Response },
  'next-auth': { getServerSession: async () => ({ user: { id: 'user' } }) },
  '@/lib/auth': { authOptions: {} },
  '@seo/lib/gemini': {
    GEMINI_TEXT_MODEL_DEFAULT: 'test',
    geminiGenerateJson: async () => { modelCalls++; return { tags: ['営業', '販売'] }; },
  },
});
const post = (route, body) => route === estimate
  ? route.POST(new Request('https://doya.test/api/doyalist/estimate', { method: 'POST', body: JSON.stringify(body) }))
  : route.POST({ json: async () => body });

(async () => {
  for (const bad of [null, [], { keywords: 'abc' }, { keywords: [{}] }, { region: {} }, { industry: 4 },
    { keywords: Array(9).fill('word') }]) {
    assert.equal((await post(estimate, bad)).status, 400, JSON.stringify(bad));
  }
  assert.equal(externalCalls, 0, 'invalid preview filters must not query gBizINFO');
  const valid = await post(estimate, { industry: 'toString', keywords: [''] });
  assert.equal(valid.status, 200);
  assert.equal((await valid.json()).estimated, 0);
  assert.equal(externalCalls, 1, 'unknown industry must use the safe fallback keyword');
  const oversized = await post(estimate, { keywords: ['株式会社'], padding: 'x'.repeat(9000) });
  assert.equal(oversized.status, 413, 'oversized request must stop before provider call');
  assert.equal(externalCalls, 1);
  providerRows = { length: 0 };
  const malformed = await post(estimate, { keywords: [''] });
  assert.equal((await malformed.json()).estimated, null, 'invalid provider data must not be reported as zero matches');

  for (const bad of [null, [], { keyword: '' }, { keyword: 4 }, { keyword: '営業', industry: {} },
    { keyword: 'x'.repeat(1001) }]) {
    assert.equal((await post(expand, bad)).status, 400, JSON.stringify(bad));
  }
  assert.equal(modelCalls, 0, 'invalid keyword input must not invoke paid AI');
  assert.equal((await post(expand, { keyword: '営業', industry: 'IT' })).status, 200);
  assert.equal(modelCalls, 1);
  console.log('PASS Doyalist helpers: malformed input rejected before external APIs and safe industry fallback');
})().catch((error) => { console.error(error); process.exitCode = 1; });
