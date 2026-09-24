const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');

let membershipRole = 'owner';
const { aioSend, aioGet, AioApiError } = load('src/lib/aio/client.ts', {}, {
  fetch: async (url, init) => {
    const path = new URL(url, 'https://example.test').pathname;
    assert.equal(new URL(url, 'https://example.test').searchParams.get('org'), 'acme');
    if (path === '/api/aio/scans' && init?.method === 'POST') {
      return Response.json({ error: '無料枠に達しました', code: 'LIMIT', upgradeUrl: '/aio/pricing' }, { status: 402 });
    }
    if (path === '/api/aio/scans') return Response.json({ items: [] });
    if (path === '/api/aio/brand-profile') return Response.json({ profile: { brandName: 'Acme' } });
    if (path === '/api/aio/prompts') return Response.json({ prompts: [] });
    if (path === '/api/aio/me') return Response.json({ plan: 'FREE', memberships: membershipRole ? [{ slug: 'acme', role: membershipRole }] : [] });
    throw new Error(`Unexpected path: ${path}`);
  },
});

(async () => {
  await assert.rejects(() => aioSend('/api/aio/scans', 'acme', 'POST'), (error) => {
    assert.ok(error instanceof AioApiError);
    assert.equal(error.code, 'LIMIT');
    assert.equal(error.status, 402);
    assert.equal(error.message, '無料枠に達しました');
    return true;
  });
  const { readAioDashboard } = load('src/lib/aio/dashboard.ts', { './client': { aioGet } });
  assert.equal((await readAioDashboard('acme')).isOwner, true);
  membershipRole = 'member';
  assert.equal((await readAioDashboard('acme')).isOwner, false);
  membershipRole = '';
  await assert.rejects(() => readAioDashboard('acme'), /組織の権限/);
  console.log('PASS AIO limit: API code reaches client and organization owner is identified');
})().catch((error) => { console.error(error); process.exitCode = 1; });
