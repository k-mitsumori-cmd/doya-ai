const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { load } = require('./load-typescript.cjs');

const budgetSource = fs.readFileSync(path.join(__dirname, '../../src/lib/interview/article-budget.ts'), 'utf8');
assert.match(budgetSource, /ON CONFLICT \("key"\) DO UPDATE/);
assert.match(budgetSource, /'Asia\/Tokyo'/);
assert.match(budgetSource, /'count'\)::integer < \$\{limit\}/);
assert.match(budgetSource, /"value"::jsonb->>'day' = \$\{claim\.day\}/);
const projectSource = fs.readFileSync(path.join(__dirname, '../../src/app/api/interview/projects/route.ts'), 'utf8');
assert.doesNotMatch(projectSource, /interviewDailyLimit|createdAt: \{ gte: start/);
const { normalizePlan } = load('src/lib/interview/access.ts', {
  'next/server': {}, 'next-auth': { getServerSession: async () => null }, '@/lib/auth': { authOptions: {} },
});
assert.equal(normalizePlan('BUNDLE'), 'PRO');
assert.equal(normalizePlan('LIGHT'), 'LIGHT');
assert.equal(normalizePlan('ENTERPRISE'), 'ENTERPRISE');
const { interviewArticleDailyLimit } = load('src/lib/interview/article-budget.ts', {
  'node:crypto': { createHash: () => ({ update: () => ({ digest: () => 'hash' }) }), randomUUID: () => 'uuid' },
  '@/lib/prisma': { prisma: {} },
});
assert.equal(interviewArticleDailyLimit('GUEST'), 2);
assert.equal(interviewArticleDailyLimit('FREE'), 5);
assert.equal(interviewArticleDailyLimit('LIGHT'), 10);
assert.equal(interviewArticleDailyLimit('PRO'), 30);
assert.equal(interviewArticleDailyLimit('ENTERPRISE'), 100);

let admission = { state: 'limit', limit: 5 };
let providerCalls = 0;
let drafts = 0;
let refunds = 0;
let failProvider = false;
let claimedIdentity;
const prisma = {
  interviewProject: {
    findUnique: async () => ({ id: 'p1', userId: 'u1', title: 'Test', transcriptions: [{ text: 'material' }], materials: [] }),
    update: async () => ({}),
  },
  interviewRecipe: { findUnique: async () => ({ id: 'r1', name: 'Test', editingGuidelines: '', category: 'GENERAL' }), update: async () => ({}) },
  interviewDraft: { aggregate: async () => ({ _max: { version: drafts } }), create: async () => ({ id: `d${++drafts}` }) },
};
const { POST } = load('src/app/api/interview/articles/generate/route.ts', {
  'next/server': {},
  '@/lib/prisma': { prisma },
  '@/lib/interview/access': {
    getInterviewUser: async () => ({ userId: 'u1', plan: 'FREE' }),
    getGuestIdFromRequest: () => null,
    checkOwnership: () => null,
    requireDatabase: () => null,
  },
  '@/lib/interview/prompts': { buildArticlePrompt: () => 'prompt' },
  '@/lib/service-usage': { recordServiceUsage: async () => {} },
  '@/lib/interview/article-budget': {
    claimArticleBudget: async (identity) => { claimedIdentity = identity; return admission; },
    refundArticleBudget: async () => { refunds++; },
  },
}, {
  TextEncoder, TextDecoder, ReadableStream,
  process: { env: { GEMINI_API_KEY: 'test-key' } },
  fetch: async () => {
    providerCalls++;
    if (failProvider) return new Response('provider failed', { status: 500 });
    return new Response('data: {"candidates":[{"content":{"parts":[{"text":"article"}]}}]}\n\n');
  },
});

const request = () => ({ json: async () => ({ projectId: 'p1', recipeId: 'r1' }) });
async function events() {
  const res = await POST(request());
  return (await res.text()).split('\n').filter((line) => line.startsWith('data: ')).map((line) => JSON.parse(line.slice(6)));
}

(async () => {
  let output = await events();
  assert.equal(output.at(-1).code, 'ARTICLE_LIMIT');
  assert.equal(output.at(-1).upgradePath, '/interview/pricing');
  assert.equal(providerCalls, 0);
  assert.equal(drafts, 0);
  assert.equal(refunds, 0);

  admission = { state: 'allowed', claim: { key: 'test', day: '2026-09-23' }, limit: 5 };
  failProvider = true;
  output = await events();
  assert.equal(output.at(-1).type, 'error');
  assert.equal(refunds, 1);
  assert.equal(drafts, 0);

  failProvider = false;
  output = await events();
  assert.equal(output.at(-1).type, 'done');
  assert.equal(refunds, 1);
  assert.equal(drafts, 1);
  assert.equal(claimedIdentity.userId, 'u1');
  assert.equal(claimedIdentity.plan, 'FREE');
  console.log('PASS interview article limit: blocked before provider, failed attempt refunded, saved article counted');
})().catch((error) => { console.error(error); process.exitCode = 1; });
