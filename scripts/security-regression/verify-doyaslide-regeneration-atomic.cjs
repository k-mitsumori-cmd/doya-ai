const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');

function fixture(kind, mode = 'success') {
  let slide = { id: 'slide', version: 1, imageUrl: 'old.png', rawImageUrl: 'old-raw.png', visualPrompt: 'old prompt', status: 'done', index: 1, role: 'body', headline: 'Title', subText: 'Copy', project: { userId: 'user', themeColor: '#fff' } };
  if (mode === 'active') slide.status = 'generating';
  let versions = [];
  let messages = [];
  let reserves = 0;
  let releases = 0;
  let generations = 0;
  const lazy = (fn) => ({ then: (resolve, reject) => Promise.resolve().then(fn).then(resolve, reject) });
  const prisma = {
    doyaSlideSlide: {
      findUnique: async () => structuredClone(slide),
      update: ({ where, data }) => lazy(() => {
        if (mode === 'mark' && data.status === 'generating') throw Error('mark failed');
        if (where.version !== undefined && (slide.version !== where.version || slide.imageUrl !== where.imageUrl || slide.visualPrompt !== where.visualPrompt || slide.status !== where.status)) {
          throw Object.assign(Error('stale slide'), { code: 'P2025' });
        }
        slide = { ...slide, ...data };
        return structuredClone(slide);
      }),
      updateMany: async ({ where, data }) => {
        if (slide.version === where.version && slide.imageUrl === where.imageUrl && slide.status === where.status) {
          slide = { ...slide, ...data };
          return { count: 1 };
        }
        return { count: 0 };
      },
    },
    doyaSlideVersion: { create: ({ data }) => lazy(() => {
      if (mode === 'version') throw Error('version failed');
      versions.push(data);
      return data;
    }) },
    doyaSlideChatMessage: { create: ({ data }) => lazy(() => {
      if (mode === 'assistant' && data.role === 'assistant') throw Error('assistant failed');
      messages.push(data);
      return data;
    }) },
    $transaction: async (operations) => {
      const before = structuredClone({ slide, versions, messages });
      try { const values = []; for (const op of operations) values.push(await op); return values; }
      catch (error) { ({ slide, versions, messages } = before); throw error; }
    },
  };
  const deps = {
    'next/server': { NextResponse: Response },
    '@/lib/prisma': { prisma },
    '@/lib/doyaslide/access': { getUserId: async () => 'user' },
    '@/lib/doyaslide/limits': {
      reserveMonthlySlides: async () => { reserves++; return { granted: mode === 'quota' ? 0 : 1, limit: 20 }; },
      releaseMonthlySlides: async () => { releases++; },
      quotaExceededMessage: () => 'quota reached',
    },
    '@/lib/doyaslide/generate': { composeSlideImage: async () => {
      generations++;
      if (mode === 'compose') throw Error('generation failed');
      if (mode === 'conflict') slide.version = 2;
      return { imageUrl: 'new.png', rawImageUrl: 'new-raw.png', model: 'mock' };
    } },
    '@/lib/doyaslide/vision': { reviseSlidePrompt: async () => 'new prompt' },
    '@/lib/doyaslide/logo': { fetchBuffer: async () => { throw Error('skip vision'); } },
    '@/lib/fetch-timeout': { raceTimeout: async (_, __, promise) => promise },
  };
  const api = load(`src/app/api/doyaslide/slides/[id]/${kind}/route.ts`, deps);
  return {
    post: (body = { message: 'change color' }) => api.POST({ json: async () => body }, { params: Promise.resolve({ id: 'slide' }) }),
    get slide() { return slide; }, get versions() { return versions; }, get messages() { return messages; },
    get reserves() { return reserves; }, get releases() { return releases; }, get generations() { return generations; },
  };
}

(async () => {
  for (const kind of ['chat', 'regenerate']) {
    const active = fixture(kind, 'active');
    assert.equal((await active.post()).status, 409, `${kind}: active`);
    assert.equal(active.reserves, 0, `${kind}: active quota`);
    const success = fixture(kind);
    assert.equal((await success.post()).status, 200, kind);
    assert.equal(success.releases, 0);
    assert.equal(success.slide.imageUrl, 'new.png');
    assert.equal(success.versions.length, 1);
    assert.equal(success.messages.length, kind === 'chat' ? 2 : 0);

    for (const mode of kind === 'chat' ? ['compose', 'version', 'assistant'] : ['mark', 'compose', 'version']) {
      const failed = fixture(kind, mode);
      assert.equal((await failed.post()).status, 500, `${kind}: ${mode}`);
      assert.equal(failed.releases, 1, `${kind}: ${mode} refund`);
      assert.equal(failed.slide.imageUrl, 'old.png', `${kind}: ${mode} image`);
      assert.equal(failed.versions.length, 0, `${kind}: ${mode} versions`);
      assert.equal(failed.messages.length, 0, `${kind}: ${mode} messages`);
    }
    const conflict = fixture(kind, 'conflict');
    assert.equal((await conflict.post()).status, 409);
    assert.equal(conflict.releases, 1);
    assert.equal(conflict.versions.length, 0);

    const quota = fixture(kind, 'quota');
    assert.equal((await quota.post()).status, 403);
    assert.equal(quota.generations, 0);
    assert.equal(quota.releases, 0);
  }
  const invalid = fixture('chat');
  assert.equal((await invalid.post({ message: {} })).status, 400);
  assert.equal(invalid.reserves, 0);
  assert.equal((await invalid.post({ message: 'x'.repeat(2001) })).status, 400);
  assert.equal(invalid.reserves, 0);
  console.log('PASS DoyaSlide chat/regenerate: validation, atomic history, refund on failure, stale-write rejection');
})().catch((error) => { console.error(error); process.exitCode = 1; });
