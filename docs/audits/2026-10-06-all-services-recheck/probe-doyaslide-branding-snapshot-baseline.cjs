const assert = require('node:assert/strict');
const { load } = require('/Users/mitsumori_katsuki/Code/09_Cursol/scripts/security-regression/load-typescript.cjs');

function fixture(kind, mode = 'success') {
  let slide = { id: 'slide', version: 1, imageUrl: 'old.png', rawImageUrl: 'old-raw.png', visualPrompt: 'old prompt', status: 'done', index: 1, role: 'body', headline: 'Title', subText: 'Copy', project: { userId: 'user', themeColor: '#fff', logoSize: 'M', updatedAt: new Date('2026-10-06T00:00:00Z') } };
  if (mode === 'active') slide.status = 'generating';
  let versions = [];
  let messages = [];
  let reserves = 0;
  let releases = 0;
  let generations = 0; let observedLogoSize;
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
      reserveMonthlySlides: async () => { reserves++; if(mode==='branding'){slide.project.logoSize='L';slide.project.updatedAt=new Date('2026-10-06T00:00:01Z')} return { granted: mode === 'quota' ? 0 : 1, limit: 20 }; },
      releaseMonthlySlides: async () => { releases++; },
      quotaExceededPayload: () => ({ error: 'quota reached', code: 'LIMIT_REACHED', limit: 20, upgradeUrl: '/doyaslide/pricing' }),
    },
    '@/lib/doyaslide/generate': { composeSlideImage: async (_userId, projectSnapshot) => { observedLogoSize=projectSnapshot.logoSize;
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
    get observedLogoSize() {return observedLogoSize;}, get reserves() { return reserves; }, get releases() { return releases; }, get generations() { return generations; },
  };
}

(async()=>{const results=[];for(const kind of ['chat','regenerate']){const f=fixture(kind,'branding'),res=await f.post();assert.equal(res.status,200);assert.equal(f.observedLogoSize,'M');assert.equal(f.slide.project.logoSize,'L');results.push({kind,status:res.status,currentLogoSize:f.slide.project.logoSize,generatedLogoSize:f.observedLogoSize,oldBrandingPersisted:f.slide.imageUrl==='new.png'&&f.observedLogoSize!==f.slide.project.logoSize,reserves:f.reserves,releases:f.releases})}console.log(JSON.stringify({scope:'Actual regenerate/chat APIs with synthetic auth, quota, provider and Prisma. Branding changes injected during quota wait. No real DB writes, customer data, storage or paid generation.',results},null,2))})().catch(e=>{console.error(e);process.exitCode=1})
