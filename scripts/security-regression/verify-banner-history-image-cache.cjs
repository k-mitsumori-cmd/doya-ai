const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');

const source = 'src/app/api/banner/history/image/route.ts';
const privateResponse = load('src/lib/private-api-response.ts', { 'next/server': { NextResponse: Response } });
const cutoff = new Date('2026-10-01T00:00:00.000Z');
const image = 'data:image/png;base64,c3ludGhldGlj';
const cases = [];

(async () => {
  for (const mode of ['unauthenticated', 'missing-id', 'expired-history', 'not-found', 'empty-output', 'success', 'database-error', 'session-error']) {
    const queries = [];
    const api = load(source, {
      'next/server': { NextResponse: Response },
      'next-auth': { getServerSession: async () => {
        if (mode === 'session-error') throw Error('SYNTHETIC_PRIVATE_ERROR');
        return mode === 'unauthenticated' ? null : { user: { id: 'synthetic-owner' } };
      } },
      '@/lib/auth': { authOptions: {} },
      '@/lib/private-api-response': privateResponse,
      '@/lib/banner/history-access': { bannerHistoryCutoff: async () => mode === 'expired-history' ? null : cutoff },
      '@/lib/prisma': { prisma: { generation: { findFirst: async query => {
        queries.push(query);
        if (mode === 'database-error') throw Error('SYNTHETIC_PRIVATE_ERROR');
        return mode === 'not-found' ? null : { output: mode === 'empty-output' ? '' : image };
      } } } },
    });

    const request = new Request('https://audit.invalid/api/banner/history/image' + (mode === 'missing-id' ? '' : '?id=synthetic-generation'));
    const response = await api.GET(request);
    const body = await response.json();
    const expectedStatus = mode === 'unauthenticated' ? 401 : mode === 'missing-id' ? 400 : ['expired-history', 'not-found', 'empty-output'].includes(mode) ? 404 : mode === 'success' ? 200 : 500;
    assert.equal(response.status, expectedStatus, mode);
    assert.equal(JSON.stringify(body).includes('SYNTHETIC_PRIVATE_ERROR'), false, mode);
    const expectedBody = mode === 'success' ? { image } : { error: mode === 'unauthenticated' ? 'unauthorized' : mode === 'missing-id' ? 'id is required' : expectedStatus === 404 ? 'not found' : 'failed' };
    assert.deepEqual(body, expectedBody, mode);
    if (['unauthenticated', 'missing-id', 'expired-history', 'session-error'].includes(mode)) assert.equal(queries.length, 0, mode);
    else {
      assert.equal(queries.length, 1, mode);
      const where = queries[0].where;
      assert.equal(where.id, 'synthetic-generation');
      assert.equal(where.userId, 'synthetic-owner');
      assert.equal(where.serviceId, 'banner');
      assert.equal(where.outputType, 'IMAGE');
      assert.equal(+where.createdAt.gte, +cutoff);
      assert.equal(queries[0].select.output, true);
    }
    const cacheControl = response.headers.get('cache-control') || '';
    const vary = response.headers.get('vary') || '';
    const privateNoStore = ['private', 'no-store'].every(value => cacheControl.toLowerCase().split(',').some(part => part.trim() === value));
    const variesByCookie = vary.toLowerCase().split(',').some(value => value.trim() === 'cookie');
    cases.push({ mode, status: response.status, behaviorPassed: true, cacheControl, vary, passed: privateNoStore && variesByCookie });
  }
  const passed = cases.filter(result => result.passed).length;
  console.log(JSON.stringify({ source, expected: 8, passed, cases, scope: 'Actual GET handler with synthetic session and read-only DB fixtures; no network, real rows, generation, mutation or deployment proof.' }));
  process.exitCode = passed === 8 ? 0 : 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
