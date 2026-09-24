const assert = require('node:assert/strict');
const { z } = require('zod');
const { load } = require('./load-typescript.cjs');

async function run(identity, plan) {
  const article = { id: 'article-1', userId: 'owner', status: 'DONE', title: 'Private title', finalMarkdown: '## Private heading\nPrivate body', targetChars: 1000 };
  let reads = 0;
  let aiCalls = 0;
  const { POST } = load('src/app/api/seo/articles/[id]/chat-edit/route.ts', {
    'next/server': { NextResponse: Response },
    'next-auth': { getServerSession: async () => identity ? { user: { id: identity, plan } } : null },
    '@/lib/auth': { authOptions: {} },
    '@/lib/prisma': { prisma: { seoArticle: { findFirst: async ({ where }) => {
      reads++;
      assert.equal(where.id, article.id);
      return where.userId === article.userId ? article : null;
    } } } },
    '@seo/lib/bootstrap': { ensureSeoSchema: async () => {} },
    '@seo/lib/gemini': { geminiGenerateJson: async () => { aiCalls++; return { proposedMarkdown: '## Private heading\nRevised', summary: 'Revised' }; } },
    zod: { z },
  });
  const response = await POST({ json: async () => ({ message: 'Revise the article' }) }, { params: Promise.resolve({ id: article.id }) });
  return { status: response.status, body: await response.json(), reads, aiCalls };
}

(async () => {
  let result = await run(null, 'PRO');
  assert.equal(result.status, 401);
  assert.equal(result.reads, 0);
  assert.equal(result.aiCalls, 0);

  result = await run('owner', 'FREE');
  assert.equal(result.status, 402);
  assert.equal(result.reads, 0);
  assert.equal(result.aiCalls, 0);

  result = await run('other', 'PRO');
  assert.equal(result.status, 404);
  assert.equal(result.reads, 1);
  assert.equal(result.aiCalls, 0);
  assert.equal(JSON.stringify(result.body).includes('Private'), false);

  result = await run('owner', 'PRO');
  assert.equal(result.status, 200);
  assert.equal(result.body.proposedMarkdown, '## Private heading\nRevised');
  assert.equal(result.aiCalls, 1);
  console.log('PASS SEO chat edit: paid foreign article is invisible and never sent to AI; owner remains functional');
})().catch((error) => { console.error(error); process.exitCode = 1; });
