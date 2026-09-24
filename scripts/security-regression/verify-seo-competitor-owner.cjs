const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');

async function run(identity, url) {
  const article = {
    id: 'article-1', userId: 'owner', title: 'Private title', finalMarkdown: 'Private article body',
    keywords: [], references: [], referenceUrls: [url], knowledgeItems: [],
  };
  let network = 0;
  let aiCalls = 0;
  let writes = 0;
  const prisma = {
    seoArticle: { findFirst: async ({ where }) => {
      assert.equal(where.id, article.id);
      return where.userId === article.userId ? article : null;
    } },
    seoKnowledgeItem: { create: async () => { writes++; } },
  };
  const { POST } = load('src/app/api/seo/articles/[id]/competitor-analysis/route.ts', {
    'next/server': { NextResponse: Response },
    'next-auth': { getServerSession: async () => identity ? { user: { id: identity } } : null },
    '@/lib/auth': { authOptions: {} },
    '@/lib/prisma': { __esModule: true, default: prisma },
    '@seo/lib/gemini': { geminiGenerateText: async () => { aiCalls++; return 'Analysis'; }, GEMINI_TEXT_MODEL_DEFAULT: 'test' },
    '@/lib/net/safe-fetch': { safeFetchText: async (target) => {
      network++;
      assert.equal(target, url);
      return target.includes('127.0.0.1') ? null : '<html><title>Competitor</title><body>' + 'text '.repeat(60) + '</body></html>';
    } },
  }, { fetch: async () => { throw new Error('Unsafe global fetch must not be used'); } });
  const response = await POST({}, { params: Promise.resolve({ id: article.id }) });
  return { status: response.status, body: await response.json(), network, aiCalls, writes };
}

(async () => {
  let result = await run(null, 'https://example.com');
  assert.equal(result.status, 401);
  assert.equal(result.network, 0);
  assert.equal(result.aiCalls, 0);

  result = await run('other', 'https://example.com');
  assert.equal(result.status, 404);
  assert.equal(result.network, 0);
  assert.equal(result.aiCalls, 0);
  assert.equal(result.writes, 0);

  result = await run('owner', 'http://127.0.0.1/internal');
  assert.equal(result.status, 400);
  assert.equal(result.network, 1);
  assert.equal(result.aiCalls, 0);

  result = await run('owner', 'https://example.com');
  assert.equal(result.status, 200);
  assert.equal(result.body.report, 'Analysis');
  assert.equal(result.aiCalls, 1);
  assert.equal(result.writes, 1);
  console.log('PASS SEO competitor analysis: foreign article blocked; outbound URL uses safe transport before AI');
})().catch((error) => { console.error(error); process.exitCode = 1; });
