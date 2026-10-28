const assert = require('node:assert/strict');
const { Readable, PassThrough } = require('node:stream');
const { load } = require('./load-typescript.cjs');

const routes = ['adimage/concepts/[id]/export', 'doyaslide/export', 'doyalist/export', 'doyalist/export-all'];
function fixture(route, mode) {
  const queries = [];
  const read = async args => {
    queries.push(args);
    if (mode === 'failure') throw Error('SYNTHETIC_PRIVATE_DB_DETAIL');
    if (mode === 'success') return route.startsWith('doyaslide')
      ? { title: 'Synthetic slide', slides: [{ index: 1, imageUrl: 'https://example.invalid/image.png' }] }
      : { userId: 'synthetic-owner', name: 'Synthetic list' };
    return route.endsWith('export-all') ? [] : null;
  };
  const userId = mode === 'anonymous' ? null : 'synthetic-owner';
  const unused = () => { throw Error('Unexpected generation/storage/archive access'); };
  const api = load(`src/app/api/${route}/route.ts`, {
    'next/server': { NextResponse: Response },
    'next-auth': { getServerSession: async () => userId ? { user: { id: userId } } : null },
    '@/lib/auth': { authOptions: {} },
    '@/lib/prisma': { prisma: {
      adImageConcept: { findFirst: read }, doyaSlideProject: { findFirst: read },
      doyalistProject: { findUnique: read, findFirst: read, findMany: read },
    } },
    '@/lib/adimage/access': {
      getIdentity: async () => ({ userId }), requireUser: () => ({ ok: !!userId, reason: 'Login required' }),
      ownerWhere: () => ({ userId }),
    },
    '@/lib/adimage/storage': { downloadBuffer: unused },
    '@/lib/adimage/placements': { findPlacement: unused },
    '@/lib/doyaslide/access': { getUserId: async () => userId },
    '@/lib/doyaslide/logo': { fetchBuffer: async () => Buffer.from('synthetic-image') },
    '@/lib/doyaslide/storage': { uploadExportFile: async () => ({ url: 'https://example.invalid/synthetic-private-export.pdf' }) },
    '@/lib/doyaslide/errors': { errorSuffix: () => '' },
    '@/lib/fetch-timeout': { raceTimeout: async (_label, _ms, promise) => promise },
    '@/lib/doyalist/export-stream': {
      encodeDoyalistExport: async function* (value) { for await (const chunk of value) yield Buffer.from(chunk); },
      iterateDoyalistCsv: async function* () { yield 'name\nSynthetic list\n'; },
      preflightDoyalistExport: async () => ({}),
      iterateDoyalistApproaches: unused, iterateDoyalistCompanies: unused,
    },
    'node:stream': { Readable, PassThrough },
    sharp: () => ({ png: () => ({ toBuffer: async () => Buffer.from('synthetic-png') }), metadata: async () => ({ width: 1536, height: 1024 }) }),
    archiver: unused,
    jspdf: { jsPDF: class { addImage() {} output() { return new Uint8Array([1, 2, 3]).buffer; } } },
  });
  return { api, queries };
}
(async () => {
  let passed = 0;
  for (const route of routes) for (const mode of ['anonymous', 'missing', 'failure']) {
    const { api, queries } = fixture(route, mode);
    const response = await api.GET(new Request('https://example.invalid/export?projectId=synthetic-project&format=csv'), { params: Promise.resolve({ id: 'synthetic-project' }) });
    const body = await response.json();
    assert.equal(response.status, mode === 'anonymous' ? 401 : mode === 'missing' ? 404 : route.startsWith('adimage') ? 502 : 500);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.ok(response.headers.get('vary').split(',').some(value => value.trim().toLowerCase() === 'cookie'));
    assert.equal(JSON.stringify(body).includes('SYNTHETIC_PRIVATE_DB_DETAIL'), false);
    assert.equal(queries.length, mode === 'anonymous' ? 0 : 1);
    if (queries.length && (route.startsWith('doyaslide') || route.endsWith('export-all'))) assert.equal(queries[0].where.userId, 'synthetic-owner');
    passed++;
    console.log(`PASS ${route} ${mode}: status, private cache, error redaction, DB boundary`);
  }
  for (const route of ['doyaslide/export', 'doyalist/export']) {
    const { api } = fixture(route, 'success');
    const response = await api.GET(new Request('https://example.invalid/export?projectId=synthetic-project&format=csv'));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.ok(response.headers.get('vary').split(',').some(value => value.trim().toLowerCase() === 'cookie'));
    if (route.startsWith('doyaslide')) assert.equal((await response.json()).url, 'https://example.invalid/synthetic-private-export.pdf');
    else {
      assert.equal(response.headers.get('content-type'), 'text/csv; charset=utf-8');
      assert.ok(response.headers.get('content-disposition').includes('.csv'));
      assert.equal(await response.text(), 'name\nSynthetic list\n');
    }
    passed++;
    console.log(`PASS ${route} success: private artifact response, body and download headers retained`);
  }
  console.log(`${passed} export privacy cases passed; synthetic auth/DB only, no network or generation.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
