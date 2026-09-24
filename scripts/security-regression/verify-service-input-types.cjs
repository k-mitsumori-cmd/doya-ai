const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');

const server = { NextResponse: Response };
const request = (body) => ({ json: async () => body });
const params = { params: Promise.resolve({ id: 'item' }) };

async function checkRoute(name, handler, invalid, valid, getWrites) {
  for (const body of invalid) {
    const before = getWrites();
    const response = await handler(request(body));
    assert.equal(response.status, 400, `${name}: ${JSON.stringify(body)}`);
    assert.equal(getWrites(), before, `${name}: invalid input must not call AI or write data`);
  }
  const response = await handler(request(valid));
  assert.equal(response.status, 200, `${name}: valid input`);
  assert.ok(getWrites() > 0, `${name}: valid path reached its dependency`);
}

(async () => {
  {
    let calls = 0;
    const route = load('src/app/api/doyaslide/analyze/route.ts', {
      'next/server': server,
      '@seo/lib/gemini': { geminiGenerateJson: async () => ({ title: 'Title', brief: 'Brief' }), GEMINI_TEXT_MODEL_DEFAULT: 'mock' },
      '@/lib/doyaslide/access': { getUserId: async () => 'user' },
      '@/lib/doyaslide/scrape': { scrapeUrlText: async () => { calls++; return { title: 'Title', description: 'Brief', text: 'Text' }; } },
      '@/lib/doyaslide/prompts': { buildAnalyzePrompt: () => 'prompt' },
    });
    await checkRoute('DoyaSlide analyze', route.POST, [null, { url: {} }, { url: 42 }], { url: 'https://example.com' }, () => calls);
  }
  {
    let calls = 0;
    const route = load('src/app/api/cunning/company/analyze/route.ts', {
      'next/server': server,
      '@/lib/prisma': { prisma: { cunningCompanyProfile: { create: async () => ({ id: 'profile' }) } } },
      '@/lib/cunning/access': { getUserId: async () => 'user' },
      '@/lib/cunning/company': { analyzeCompanyUrl: async () => { calls++; return { extract: { companyName: 'Acme' }, rawText: 'Text' }; } },
    });
    await checkRoute('Cunning company analyze', route.POST, [null, { url: [] }, { url: 42 }], { url: 'https://example.com' }, () => calls);
  }
  {
    let calls = 0;
    const route = load('src/app/api/sfa/ai/next-action/route.ts', {
      'next/server': server,
      '@/lib/prisma': { prisma: {
        sfaDeal: { findUnique: async () => ({ id: 'deal', organizationId: 'org', name: 'Deal', amount: 100, probability: 50 }) },
        sfaActivity: { findMany: async () => [] },
      } },
      '@/lib/sfa/access': { getSfaContext: async () => ({ organizationId: 'org' }), orgSlugFrom: () => 'org' },
      '@/lib/sfa/ai': { suggestNextAction: async () => { calls++; return { action: 'Follow up' }; } },
      '@/lib/sfa/constants': { ACTIVITY_TYPE_LABEL: {} },
    });
    await checkRoute('SFA next action', route.POST, [null, { dealId: {} }, { dealId: 42 }], { dealId: 'deal' }, () => calls);
  }
  {
    let calls = 0;
    const route = load('src/app/api/cunning/knowledge/route.ts', {
      'next/server': server,
      '@/lib/prisma': { prisma: { cunningKnowledgeBase: { create: async () => { calls++; return { id: 'base' }; } } } },
      '@/lib/cunning/access': { getUserId: async () => 'user' },
      '@/lib/cunning/limits': { getCunningLimits: async () => ({ maxKnowledgeBases: -1 }) },
    });
    await checkRoute('Cunning knowledge create', route.POST, [null, { name: {} }, { name: 'Name', description: {} }], { name: 'Name', description: 'Description' }, () => calls);
  }
  {
    let calls = 0;
    const route = load('src/app/api/cunning/knowledge/[id]/ingest/route.ts', {
      'next/server': server,
      '@/lib/prisma': { prisma: {
        cunningKnowledgeBase: { findUnique: async () => ({ userId: 'user' }), update: async () => ({}) },
        cunningKnowledgeChunk: { createMany: async () => { calls++; return { count: 1 }; } },
      } },
      '@/lib/cunning/access': { getUserId: async () => 'user' },
      '@/lib/cunning/rag': { chunkText: () => ['Chunk'] },
      '@/lib/cunning/scraper': { scrapeUrl: async () => ({ text: 'Text', url: 'https://example.com', title: 'Title' }) },
    });
    await checkRoute('Cunning knowledge ingest', (req) => route.POST(req, params),
      [null, { type: {} }, { type: 'text', text: {} }, { type: 'url', url: [] }, { type: 'text', text: 'Text', label: 3 }],
      { type: 'text', text: 'Text' }, () => calls);
  }
  {
    let calls = 0;
    const route = load('src/app/api/cunning/profiles/route.ts', {
      'next/server': server,
      '@/lib/prisma': { prisma: { cunningApplicantProfile: { create: async () => { calls++; return { id: 'profile' }; } } } },
      '@/lib/cunning/access': { getUserId: async () => 'user' },
    });
    await checkRoute('Cunning profile create', route.POST,
      [null, { name: {} }, { resume: [] }, { motivation: 3 }, { id: {} }],
      { name: 'Applicant', resume: 'Resume' }, () => calls);
  }
  {
    let calls = 0;
    const route = load('src/app/api/shodan/preparations/[id]/slides/regenerate/route.ts', {
      'next/server': server,
      '@/lib/prisma': { prisma: {
        user: { findUnique: async () => ({ plan: 'PRO' }) },
        shodanPreparation: { findFirst: async () => ({ id: 'item', slidesJson: [{ title: 'Slide' }], slideImages: [{ imagePath: 'old' }] }) },
        shodanCompanyProfile: { findUnique: async () => null },
      } },
      '@/lib/shodan/save-slide-images': { saveSlideImages: async () => {}, SlideImageConflict: class extends Error {} },
      '@/lib/shodan/access': { getShodanContext: async () => ({ userId: 'user', organizationId: 'org' }), orgSlugFrom: () => 'org' },
      '@/lib/shodan/slide-image': { generateSlideImage: async () => { calls++; return { title: 'Slide', role: 'body', imagePath: 'new' }; } },
      '@/lib/shodan/storage': { signedUrl: async () => 'https://example.com/image.png' },
      '@/lib/unified-plan': { isPaidPlan: () => true },
    });
    await checkRoute('Shodan slide regenerate', (req) => route.POST(req, params),
      [null, { index: {} }, { index: 0, instruction: {} }, { index: '0' }],
      { index: 0, instruction: 'Change color' }, () => calls);
  }
  {
    let calls = 0;
    const route = load('src/app/api/shodan/company-profile/route.ts', {
      'next/server': server,
      '@/lib/prisma': { prisma: { shodanCompanyProfile: { upsert: async () => { calls++; return { logoPath: null }; } } } },
      '@/lib/shodan/access': { getShodanContext: async () => ({ organizationId: 'org', role: 'owner' }), hasMinRole: () => true, orgSlugFrom: () => 'org' },
      '@/lib/shodan/storage': { signedUrl: async () => null },
    });
    await checkRoute('Shodan company profile', route.PUT,
      [null, {}, { companyName: {} }, { logoPath: 42 }, { brandColors: [5] }],
      { companyName: 'Acme', brandColors: ['#112233'] }, () => calls);
  }
  console.log('PASS active service API input types: malformed requests stop before AI calls or DB writes');
})().catch((error) => { console.error(error); process.exitCode = 1; });
