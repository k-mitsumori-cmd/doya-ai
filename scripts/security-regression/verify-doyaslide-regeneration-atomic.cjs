function withMockProjectLock(mocks) { const db=mocks['@/lib/prisma'].prisma; let tail=Promise.resolve(); mocks['@/lib/doyaslide/project-lock']={ withDoyaSlideProjectLock:(_id,_user,work)=>{ const next=tail.then(()=>db.$transaction ? db.$transaction(work) : work(db)); tail=next.catch(()=>{}); return next } }; return mocks }
const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');
const testResults = [];

function fixture(kind, mode = 'success') {
  let slide = { id: 'slide', projectId: 'project', version: 1, imageUrl: 'old.png', rawImageUrl: 'old-raw.png', visualPrompt: 'old prompt', status: 'done', index: 1, role: 'body', headline: 'Title', subText: 'Copy', project: { userId: 'user', themeColor: '#fff', status: 'completed', updatedAt: new Date('2026-10-06T00:00:00Z'), logoSize: 'M' } };
  if (mode === 'active') slide.status = 'generating';
  if (mode === 'project_busy') slide.project.status = 'generating';
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
        if (where.project) {
          assert.equal(where.project.userId, 'user');
          if (slide.project.userId !== where.project.userId || (where.project.updatedAt && slide.project.updatedAt.getTime() !== where.project.updatedAt.getTime()) || where.project.status?.notIn.includes(slide.project.status)) throw Object.assign(Error('stale project'), { code: 'P2025' });
        }
        if (where.version !== undefined && (slide.version !== where.version || slide.imageUrl !== where.imageUrl || slide.visualPrompt !== where.visualPrompt || slide.status !== where.status)) {
          throw Object.assign(Error('stale slide'), { code: 'P2025' });
        }
        slide = { ...slide, ...data };
        return structuredClone(slide);
      }),
      updateMany: async ({ where, data }) => {
        if (slide.version === where.version && slide.imageUrl === where.imageUrl && slide.status === where.status && slide.project.userId === where.project.userId) {
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
      try { if(typeof operations==='function') return await operations(prisma); const values = []; for (const op of operations) values.push(await op); return values; }
      catch (error) { ({ slide, versions, messages } = before); throw error; }
    },
  };
  const deps = {
    'next/server': { NextResponse: Response },
    '@/lib/prisma': { prisma },
    '@/lib/doyaslide/access': { getUserId: async () => 'user' },
    '@/lib/doyaslide/limits': {
      reserveMonthlySlides: async () => { reserves++; if(mode==='brand_before')slide.project.updatedAt=new Date(slide.project.updatedAt.getTime()+100);if(mode==='owner_before')slide.project.userId='other'; return { granted: mode === 'quota' ? 0 : 1, limit: 20 }; },
      releaseMonthlySlides: async () => { releases++; if(mode==='refund_fails')throw Error('synthetic refund failure'); },
      quotaExceededPayload: () => ({ error: 'quota reached', code: 'LIMIT_REACHED', limit: 20, upgradeUrl: '/doyaslide/pricing' }),
    },
    '@/lib/doyaslide/generate': { composeSlideImage: async () => {
      generations++;
      if (mode === 'compose' || mode === 'refund_fails') throw Error('generation failed');
      if (mode === 'conflict') slide.version = 2;
      if(mode==='brand_during')slide.project.updatedAt=new Date(slide.project.updatedAt.getTime()+100);
      if(mode==='owner_during')slide.project.userId='other';
      if(mode==='project_during')slide.project.status='generating';
      return { imageUrl: 'new.png', rawImageUrl: 'new-raw.png', model: 'mock' };
    } },
    '@/lib/doyaslide/vision': { reviseSlidePrompt: async () => 'new prompt' },
    '@/lib/doyaslide/logo': { fetchBuffer: async () => { throw Error('skip vision'); } },
    '@/lib/fetch-timeout': { raceTimeout: async (_, __, promise) => promise },
  };
  const api = load(`src/app/api/doyaslide/slides/[id]/${kind}/route.ts`, withMockProjectLock(deps));
  return {
    post: async (body = { message: 'change color' }) => { const response = await api.POST({ json: async () => body }, { params: Promise.resolve({ id: 'slide' }) }); testResults.push({ kind, mode, status: response.status, generations, releases, versions: versions.length, messages: messages.length }); return response; },
    get slide() { return slide; }, get versions() { return versions; }, get messages() { return messages; },
    get reserves() { return reserves; }, get releases() { return releases; }, get generations() { return generations; },
  };
}

(async () => {
  for (const kind of ['chat', 'regenerate']) {
    const active = fixture(kind, 'active');
    assert.equal((await active.post()).status, 409, `${kind}: active`);
    assert.equal(active.reserves, 0, `${kind}: active quota`);
    const busyProject = fixture(kind, 'project_busy');
    assert.equal((await busyProject.post()).status,409);
    assert.equal(busyProject.reserves,0);
    const success = fixture(kind);
    assert.equal((await success.post()).status, 200, kind);
    assert.equal(success.releases, 0);
    assert.equal(success.slide.imageUrl, 'new.png');
    assert.equal(success.versions.length, 1);
    assert.equal(success.messages.length, kind === 'chat' ? 2 : 0);

    for (const mode of kind === 'chat' ? ['mark', 'compose', 'version', 'assistant', 'refund_fails'] : ['mark', 'compose', 'version', 'refund_fails']) {
      const failed = fixture(kind, mode);
      assert.equal((await failed.post()).status, 500, `${kind}: ${mode}`);
      assert.equal(failed.releases, 1, `${kind}: ${mode} refund`);
      assert.notEqual(failed.slide.status, 'generating', `${kind}: ${mode} lock cleanup`);
      assert.equal(failed.slide.imageUrl, 'old.png', `${kind}: ${mode} image`);
      assert.equal(failed.versions.length, 0, `${kind}: ${mode} versions`);
      assert.equal(failed.messages.length, 0, `${kind}: ${mode} messages`);
    }
    const conflict = fixture(kind, 'conflict');
    assert.equal((await conflict.post()).status, 409);
    assert.equal(conflict.releases, 1);
    assert.equal(conflict.versions.length, 0);

    for(const mode of ['brand_before','owner_before','brand_during','owner_during','project_during']) {
      const f=fixture(kind,mode); assert.equal((await f.post()).status,409,`${kind}: ${mode}`);
      assert.equal(f.slide.imageUrl,'old.png'); assert.equal(f.versions.length,0); assert.equal(f.messages.length,0); assert.equal(f.releases,1);
      if(mode.endsWith('before')) assert.equal(f.generations,0,`${kind}: ${mode} avoids provider`);
      if(!mode.startsWith('owner_'))assert.notEqual(f.slide.status,'generating',`${kind}: ${mode} unlock`);
    }
    const parallel = fixture(kind);
    const replies = await Promise.all([parallel.post(),parallel.post()]);
    assert.deepEqual(replies.map(r=>r.status).sort(),[200,409],`${kind}: concurrent callers`);
    assert.equal(parallel.generations,1);assert.equal(parallel.releases,1);assert.equal(parallel.versions.length,1);assert.equal(parallel.messages.length,kind==='chat'?2:0);

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
  console.log(JSON.stringify({ scope: 'Actual chat/regenerate APIs with synthetic Prisma, auth, quotas, providers and concurrent promises. No real DB concurrency or storage writes. Refund failure verifies lock cleanup, not successful credit return.', checkedResponses: testResults.length, results: testResults },null,2));
  console.log('PASS DoyaSlide chat/regenerate: validation, atomic history, project/branding snapshot guards, exclusive chat mark, refund failures and stale-write rejection');
})().catch((error) => { console.error(error); process.exitCode = 1; });
