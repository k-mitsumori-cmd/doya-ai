// Offline token-provider regression. No OpenAI or database requests.
const assert = require('node:assert/strict');
const { load, check } = require('./load-typescript.cjs');

function fixture(providerResponse, options = {}) {
  const logs = [];
  let calls = 0;
  let timeoutMs = 0;
  const session = {
    id: 'session', status: 'consented', consentedAt: new Date(), startedAt: null, endedAt: null,
    expiresAt: new Date(Date.now() + 86400000), tokenIssueCount: 0, candidateName: 'Candidate',
    organization: { name: 'Company', retentionDays: 30 },
    template: { durationMin: 15, jobTitle: 'Role', level: 'mid', intro: '', closing: '', questions: [{ text: 'Question' }] },
  };
  Object.assign(session, options.session || {});
  let starts = 0;
  let reads = 0;
  const prisma = { mensetsuSession: {
    findUnique: async () => { reads++; return options.missingAfter && reads > 1 ? null : { ...session }; },
    updateMany: async ({ where, data }) => {
      if (options.beforeReserve && data.tokenIssueCount) options.beforeReserve(session);
      if (where.status?.in && !where.status.in.includes(session.status)) return { count: 0 };
      if (where.consentedAt?.not === null && !session.consentedAt) return { count: 0 };
      if (where.endedAt === null && session.endedAt) return { count: 0 };
      if (where.startedAt === null && session.startedAt) return { count: 0 };
      if (where.expiresAt?.gt && session.expiresAt <= where.expiresAt.gt) return { count: 0 };
      if (where.tokenIssueCount?.lt !== undefined && session.tokenIssueCount >= where.tokenIssueCount.lt) return { count: 0 };
      if (data.tokenIssueCount) session.tokenIssueCount++;
      else { Object.assign(session, data); starts++; }
      return { count: 1 };
    },
  } };
  const publicApi = load('src/lib/mensetsu/public.ts', { '@/lib/prisma': { prisma } });
  const realtime = load('src/lib/realtime-token-response.ts');
  const env = { OPENAI_API_KEY: 'apiKey' in options ? options.apiKey : 'synthetic-only' };
  const route = load('src/app/api/mensetsu/live/[token]/token/route.ts', {
    'next/server': { NextResponse: Response },
    '@/lib/prisma': { prisma },
    '@/lib/mensetsu/public': publicApi,
    '@/lib/mensetsu/interview': { buildInterviewerInstructions: () => 'Instructions', ADVANCE_TOOL: {} },
    '@/lib/mensetsu/types': { LEVEL_LABELS: { mid: '中途' } },
    '@/lib/realtime-token-response': realtime,
  }, {
    AbortSignal: { timeout(ms) { timeoutMs = ms; return AbortSignal.timeout(ms); } },
    process: { env },
    console: { error: (...parts) => logs.push(parts) },
    fetch: async (_url, init) => { calls++; assert.ok(init.signal);options.duringFetch?.(session); return providerResponse(); },
  });
  return { session, logs, setApiKey: value => env.OPENAI_API_KEY = value, get starts() { return starts; }, get calls() { return calls; }, get timeoutMs() { return timeoutMs; }, run: () => route.POST({}, { params: Promise.resolve({ token: 'long-enough-token' }) }) };
}

(async () => {
  await check('Mensetsu token reads bounded provider JSON and returns only client secret', async () => {
    const f = fixture(() => Response.json({ value: 'SYNTHETIC_SECRET', expires_at: 1, session: { instructions: 'PRIVATE' } }));
    const res = await f.run();
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.clientSecret, 'SYNTHETIC_SECRET');
    assert.equal(JSON.stringify(body).includes('PRIVATE'), false);
    assert.equal(f.timeoutMs, 15000);
  });
  await check('Mensetsu provider error body never enters logs or response', async () => {
    const f = fixture(() => new Response('SENSITIVE_RESPONSE_BODY', { status: 500 }));
    const res = await f.run();
    assert.equal(res.status, 502);
    assert.equal(JSON.stringify(f.logs).includes('SENSITIVE_RESPONSE_BODY'), false);
    assert.equal((await res.text()).includes('SENSITIVE_RESPONSE_BODY'), false);
  });
  await check('Mensetsu oversized provider response is rejected', async () => {
    const f = fixture(() => new Response('x'.repeat(300000)));
    assert.equal((await f.run()).status, 502);
  });
  await check('Mensetsu missing secret does not log provider JSON', async () => {
    const f = fixture(() => Response.json({ session: { instructions: 'PRIVATE' } }));
    assert.equal((await f.run()).status, 502);
    assert.equal(JSON.stringify(f.logs).includes('PRIVATE'), false);
  });
  await check('Mensetsu ending during provider wait never restarts or receives a secret', async () => {
    const f = fixture(() => Response.json({ value: 'SYNTHETIC_SECRET' }), { duringFetch: session => { session.status = 'completed'; session.endedAt = new Date(); } });
    const res = await f.run();
    assert.equal(res.status, 409);
    assert.equal((await res.text()).includes('SYNTHETIC_SECRET'), false);
    assert.equal(f.starts, 0);
    assert.equal(f.session.status, 'completed');
  });
  await check('Mensetsu ending before quota reservation does not contact provider', async () => {
    const f = fixture(() => Response.json({ value: 'SYNTHETIC_SECRET' }), { beforeReserve: session => { session.status = 'completed'; session.endedAt = new Date(); } });
    assert.equal((await f.run()).status, 409);
    assert.equal(f.calls, 0);
  });
  await check('Mensetsu parallel start keeps the first timestamp', async () => {
    const first = new Date();
    const f = fixture(() => Response.json({ value: 'SYNTHETIC_SECRET' }), { duringFetch: session => { session.status = 'live'; session.startedAt = first; } });
    assert.equal((await f.run()).status, 200);
    assert.equal(f.session.startedAt, first);
    assert.equal(f.starts, 0);
  });
  await check('Mensetsu missing provider configuration does not exhaust connection attempts', async () => {
    const f = fixture(() => Response.json({ value: 'SYNTHETIC_SECRET' }), { apiKey: undefined });
    for (let i = 0; i < 13; i++) assert.equal((await f.run()).status, 503);
    assert.equal(f.session.tokenIssueCount, 0); assert.equal(f.calls, 0); assert.equal(f.starts, 0);
    f.setApiKey('synthetic-restored'); assert.equal((await f.run()).status, 200); assert.equal(f.session.tokenIssueCount, 1); assert.equal(f.calls, 1);
  });
  await check('Mensetsu expired conversation does not spend a connection reservation', async () => {
    const f = fixture(() => Response.json({ value: 'SYNTHETIC_SECRET' }), { session: { status: 'live', startedAt: new Date(Date.now() - 26 * 60000) } });
    assert.equal((await f.run()).status, 410); assert.equal(f.session.tokenIssueCount, 0); assert.equal(f.calls, 0);
  });
})().catch(error => { console.error(error); process.exitCode = 1; });
