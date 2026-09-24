const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');

function fixture(mode) {
  const slides = [
    { id: 'a', index: 1, version: 1, visualPrompt: 'A', imageUrl: null, status: 'pending' },
    { id: 'b', index: 2, version: 1, visualPrompt: 'B', imageUrl: null, status: 'pending' },
  ];
  let released = 0;
  let reserved = 0;
  let generated = 0;
  let usageCount = null;
  if (mode === 'active-slide') slides[0].status = 'generating';
  const lazy = (fn) => ({
    then: (resolve, reject) => Promise.resolve().then(fn).then(resolve, reject),
    catch: (reject) => Promise.resolve().then(fn).catch(reject),
  });
  const prisma = {
    doyaSlideProject: {
      findFirst: async () => ({ id: 'project', title: 'Test', status: mode === 'pending-reset' || mode === 'active-project' ? 'generating' : 'draft', updatedAt: new Date(mode === 'pending-reset' ? Date.now() - 7 * 60 * 1000 : Date.now()), slides }),
      update: async ({ data }) => {
        if (mode === 'project-start' && data.status === 'generating') throw Error('project start failed');
        return data;
      },
    },
    doyaSlideSlide: {
      updateMany: async () => { if (mode === 'pending-reset') throw Error('reset failed'); return { count: 0 }; },
      update: ({ where, data }) => lazy(() => { Object.assign(slides.find((slide) => slide.id === where.id), data); return data; }),
      findMany: async () => slides,
    },
    doyaSlideVersion: { create: ({ data }) => lazy(() => data) },
    $transaction: async (operations) => Promise.all(operations),
  };
  const api = load('src/app/api/doyaslide/generate/route.ts', {
    'next/server': { NextResponse: Response },
    '@/lib/prisma': { prisma },
    '@/lib/doyaslide/access': { getUserId: async () => 'user' },
    '@/lib/service-usage': { recordServiceUsage: async ({ count }) => { usageCount = count; } },
    '@/lib/doyaslide/limits': {
      reserveMonthlySlides: async () => { reserved++; return { granted: 2, limit: 20 }; },
      releaseMonthlySlides: async (_, count) => { released += count; },
      quotaExceededPayload: () => ({ error: 'quota', code: 'LIMIT_REACHED', limit: 20, upgradeUrl: '/doyaslide/pricing' }),
    },
    '@/lib/doyaslide/generate': { composeSlideImage: async (_, __, slide) => {
      generated++;
      if (mode === 'one-failed' && slide.id === 'b') throw Error('image failed');
      return { imageUrl: `${slide.id}.png`, rawImageUrl: `${slide.id}-raw.png`, model: 'mock' };
    } },
  });
  return { post: () => api.POST({ json: async () => ({ projectId: 'project' }) }), get reserved() { return reserved; }, get released() { return released; }, get generated() { return generated; }, get usageCount() { return usageCount; } };
}

(async () => {
  for (const mode of ['active-project', 'active-slide']) {
    const f = fixture(mode);
    assert.equal((await f.post()).status, 409, mode);
    assert.equal(f.reserved, 0, mode);
  }
  for (const mode of ['project-start', 'pending-reset']) {
    const f = fixture(mode);
    assert.equal((await f.post()).status, 500);
    assert.equal(f.released, 2, mode);
    assert.equal(f.generated, 0, mode);
  }
  const partial = fixture('one-failed');
  const response = await partial.post();
  assert.equal(response.status, 200);
  assert.equal((await response.json()).errorCount, 1);
  assert.equal(partial.released, 1);
  assert.equal(partial.usageCount, 1);
  const normal = fixture('success');
  assert.equal((await normal.post()).status, 200);
  assert.equal(normal.released, 0);
  assert.equal(normal.usageCount, 2);
  console.log('PASS DoyaSlide batch: preflight refunds and usage count reflects completed images');
})().catch((error) => { console.error(error); process.exitCode = 1; });
