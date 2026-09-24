const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');

let response = Response.json({ products: [{ id: 'p1' }] });
const { fetchOrgJson } = load('src/lib/org-fetch.ts', {}, {
  fetch: async () => response,
});

(async () => {
  assert.equal((await fetchOrgJson('/api/quote/products')).products[0].id, 'p1');

  response = Response.json({ error: '組織が見つかりません' }, { status: 401 });
  await assert.rejects(fetchOrgJson('/api/quote/products'), /組織が見つかりません/);

  response = new Response('upstream unavailable', { status: 503 });
  await assert.rejects(fetchOrgJson('/api/quote/products'), /組織のデータを取得できませんでした/);

  response = Response.json(null);
  await assert.rejects(fetchOrgJson('/api/quote/products'), /組織のデータを確認できませんでした/);
  console.log('PASS organization data fetch: API failures and malformed success are not treated as empty lists');
})().catch((error) => { console.error(error); process.exitCode = 1; });
