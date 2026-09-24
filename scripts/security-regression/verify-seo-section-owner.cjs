const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');

function fixture(identity, kind) {
  const article = { id: 'article-1', userId: kind === 'user' ? 'owner' : null, guestId: kind === 'guest' ? 'guest' : null, title: 'Private title', keywords: [] };
  const section = { id: 'section-1', articleId: article.id, article, headingPath: 'H2: Private', content: 'Private body' };
  let reads = 0;
  let writes = 0;
  let aiCalls = 0;
  const matches = (where) => where.id === section.id && where.article?.is?.userId === article.userId &&
    (article.userId !== null || where.article?.is?.guestId === article.guestId);
  const prisma = { seoSection: {
    findFirst: async ({ where }) => { reads++; return matches(where) ? section : null; },
    updateMany: async ({ where }) => { if (!matches(where)) return { count: 0 }; writes++; return { count: 1 }; },
  } };
  const owner = load('src/lib/seoArticleOwner.ts', {
    'next-auth': { getServerSession: async () => ['owner', 'other'].includes(identity) ? { user: { id: identity } } : null },
    '@/lib/auth': { authOptions: {} },
    '@/lib/seoAccess': { getGuestIdFromRequest: () => identity === 'guest' ? 'guest' : identity === 'other-guest' ? 'other-guest' : null },
  });
  const mocks = {
    'next/server': { NextResponse: Response },
    '@/lib/prisma': { prisma },
    '@/lib/seoArticleOwner': owner,
    '@seo/lib/gemini': { geminiGenerateText: async () => { aiCalls++; return 'Revised body'; }, GEMINI_TEXT_MODEL_DEFAULT: 'test' },
  };
  const routes = {
    edit: load('src/app/api/seo/sections/[id]/route.ts', mocks),
    regenerate: load('src/app/api/seo/sections/[id]/regenerate/route.ts', mocks),
    seo: load('src/app/api/seo/sections/[id]/seo/route.ts', mocks),
    cv: load('src/app/api/seo/sections/[id]/cv/route.ts', mocks),
  };
  return { routes, counts: () => ({ reads, writes, aiCalls }) };
}

(async () => {
  for (const kind of ['user', 'guest']) {
    for (const identity of ['owner', 'other', 'guest', 'other-guest', 'anonymous']) {
      for (const action of ['edit', 'regenerate', 'seo', 'cv']) {
        const f = fixture(identity, kind);
        const handler = f.routes[action][action === 'edit' ? 'PUT' : 'POST'];
        const response = await handler({ json: async () => ({ content: 'Changed', headingPath: 'H2: Private' }) }, { params: Promise.resolve({ id: 'section-1' }) });
        const allowed = kind === 'user' ? identity === 'owner' : identity === 'guest';
        assert.equal(response.status, allowed ? 200 : identity === 'anonymous' ? 401 : 404, `${kind}/${identity}/${action}`);
        const counts = f.counts();
        assert.equal(counts.reads, identity === 'anonymous' ? 0 : 1);
        assert.equal(counts.writes, allowed ? 1 : 0);
        assert.equal(counts.aiCalls, allowed && action !== 'edit' ? 1 : 0);
      }
    }
  }
  console.log('PASS SEO sections: edit and all AI actions require article ownership before provider and at write');
})().catch((error) => { console.error(error); process.exitCode = 1; });
