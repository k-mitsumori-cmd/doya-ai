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
assert.equal(normalizePlan('INTERVIEW_PRO'), 'PRO');
for (const invalid of ['NOT_PRO', 'APPROVED', 'NOT_ENTERPRISE', 'LIGHTWEIGHT']) assert.equal(normalizePlan(invalid), 'FREE', invalid);
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
let userPlan = 'FREE';
let asGuest = false;
let providerCalls = 0;
let drafts = 0;
let refunds = 0;
let failProvider = false;
let invalidKey = false;
let oversizedEvent = false;
let oversizedProviderError = false;
let failProjectUpdate = false;
let failUsageTracking = false;
let holdProvider = false;
let providerEntered = () => {};
let locks = 0;
let projectOwner = 'u1';
let projectGuestId = null;
let changeOwnerDuringProvider = false;
let lastRefundTarget = null;
let claimedIdentity;
let recipeOwner = 'u1';
let recipeIsTemplate = false;
let recipeIsPublic = false;
let budgetCalls = 0;
const prisma = {
  interviewProject: {
    findUnique: async () => ({ id: 'p1', userId: projectOwner, guestId: projectGuestId, title: 'Test', transcriptions: [{ text: 'material' }], materials: [] }),
    update: async () => { if (failProjectUpdate) throw new Error('update failed'); return {}; },
  },
  interviewRecipe: { findUnique: async () => ({ id: 'r1', name: 'Test', editingGuidelines: '', category: 'GENERAL', userId: recipeOwner, isTemplate: recipeIsTemplate, isPublic: recipeIsPublic }), update: async () => ({}) },
  interviewDraft: { aggregate: async () => ({ _max: { version: drafts } }) },
  $transaction: async (fn) => {
    let staged = false;
    const tx = {
      ...prisma,
      $executeRaw: async () => { locks++; return 1; },
      interviewDraft: {
        ...prisma.interviewDraft,
        create: async () => { staged = true; return { id: `d${drafts + 1}` }; },
      },
    };
    const result = await fn(tx);
    if (staged) drafts++;
    return result;
  },
};
assert.match(fs.readFileSync(path.join(__dirname, '../../src/app/api/interview/articles/generate/route.ts'), 'utf8'), /pg_advisory_xact_lock\(hashtext\(\$\{projectId\}\)\)/);
const { POST } = load('src/app/api/interview/articles/generate/route.ts', {
  'next/server': {},
  '@/lib/prisma': { prisma },
  '@/lib/interview/access': {
    getInterviewUser: async () => asGuest ? { userId: null, plan: 'GUEST' } : { userId: 'u1', plan: userPlan },
    getGuestIdFromRequest: () => asGuest ? 'g1' : null,
    checkOwnership: (resource, userId, guestId) => userId
      ? resource.userId === userId ? null : { status: 404 }
      : !resource.userId && resource.guestId === guestId ? null : { status: 404 },
    requireDatabase: () => null,
  },
  '@/lib/interview/prompts': { buildArticlePrompt: () => 'prompt' },
  '@/lib/service-usage': { recordServiceUsage: async () => { if (failUsageTracking) throw new Error('tracking failed'); } },
  '@/lib/interview/gemini-request': load('src/lib/interview/gemini-request.ts'),
  '@/lib/interview/article-budget': {
    claimArticleBudget: async (identity) => { assert.equal(identity.projectId, 'p1'); budgetCalls++; claimedIdentity = identity; return admission; },
    refundArticleBudget: async (_claim, transferredToUserId) => { refunds++; lastRefundTarget = transferredToUserId; },
  },
  '@/lib/pricing': { SUPPORT_CONTACT_URL: 'https://doyamarke.surisuta.jp/contact' },
}, {
  TextEncoder, TextDecoder, ReadableStream, AbortController, AbortSignal,
  process: { env: { GEMINI_API_KEY: 'test-key' } },
  fetch: async (url, init) => {
    providerCalls++;
    assert.doesNotMatch(url, /key=/);
    assert.equal(init.headers['x-goog-api-key'], 'test-key');
    if (changeOwnerDuringProvider) projectOwner = 'u2';
    if (holdProvider) return new Promise((_resolve, reject) => {
      providerEntered();
      init.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    });
    if (failProvider) return new Response('provider failed', { status: 500 });
    if (oversizedProviderError) return new Response('private', { status: 400, headers: { 'content-length': String(64 * 1024 + 1) } });
    if (invalidKey) return new Response(JSON.stringify({ error: { status: 'INVALID_ARGUMENT', message: 'API key not valid. Please pass a valid API key.' } }), { status: 400, headers: { 'content-type': 'application/json' } });
    if (oversizedEvent) return new Response(`data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: 'x'.repeat(600000) }] } }] })}\n`);
    return new Response('data: {"candidates":[{"content":{"parts":[{"text":"article"},{"text":" end"}]}}]}');
  },
});

const request = () => ({ json: async () => ({ projectId: 'p1', recipeId: 'r1' }) });
async function events() {
  projectOwner = asGuest ? null : 'u1';
  projectGuestId = asGuest ? 'g1' : null;
  const res = await POST(request());
  return (await res.text()).split('\n').filter((line) => line.startsWith('data: ')).map((line) => JSON.parse(line.slice(6)));
}

(async () => {
  recipeOwner = 'other-user';
  let output = await events();
  assert.equal(output.at(-1).message, 'レシピが見つかりません');
  assert.equal(budgetCalls, 0);
  assert.equal(providerCalls, 0);
  recipeOwner = null;
  output = await events();
  assert.equal(output.at(-1).message, 'レシピが見つかりません');
  assert.equal(budgetCalls, 0);
  recipeIsTemplate = true;
  output = await events();
  assert.equal(output.at(-1).code, 'ARTICLE_LIMIT');
  assert.equal(budgetCalls, 1);
  recipeIsTemplate = false;
  recipeIsPublic = true;
  output = await events();
  assert.equal(output.at(-1).code, 'ARTICLE_LIMIT');
  recipeIsPublic = false;
  recipeOwner = 'u1';
  output = await events();
  assert.equal(output.at(-1).code, 'ARTICLE_LIMIT');
  assert.equal(output.at(-1).upgradePath, '/interview/pricing');
  userPlan = 'PRO';
  output = await events();
  assert.equal(output.at(-1).contactUrl, 'https://doyamarke.surisuta.jp/contact');
  assert.equal(output.at(-1).upgradePath, undefined);
  userPlan = 'FREE';
  assert.equal(providerCalls, 0);
  assert.equal(drafts, 0);
  assert.equal(refunds, 0);

  admission = { state: 'owner_changed' };
  output = await events();
  assert.equal(output.at(-1).code, 'PROJECT_OWNER_CHANGED');
  assert.equal(providerCalls, 0);

  admission = { state: 'allowed', claim: { key: 'test', day: '2026-09-23' }, limit: 5 };
  failProvider = true;
  output = await events();
  assert.equal(output.at(-1).type, 'error');
  assert.equal(refunds, 1);
  assert.equal(drafts, 0);

  failProvider = false;
  invalidKey = true;
  output = await events();
  assert.equal(output.at(-1).code, 'ARTICLE_PROVIDER_CONFIGURATION');
  assert.equal(refunds, 2);
  assert.equal(drafts, 0);
  invalidKey = false;
  output = await events();
  assert.equal(output.at(-1).type, 'done');
  assert.equal(output.at(-1).wordCount, 11);
  assert.equal(refunds, 2);
  assert.equal(drafts, 1);
  assert.equal(locks, 2);
  assert.equal(claimedIdentity.userId, 'u1');
  assert.equal(claimedIdentity.plan, 'FREE');
  failProjectUpdate = true;
  output = await events();
  assert.equal(output.at(-1).type, 'error');
  assert.equal(refunds, 3);
  assert.equal(drafts, 1);
  failProjectUpdate = false;
  output = await events();
  assert.equal(output.at(-1).type, 'done');
  assert.equal(output.at(-1).version, 2);
  assert.equal(drafts, 2);
  failUsageTracking = true;
  output = await events();
  assert.equal(output.at(-1).type, 'done');
  assert.equal(output.at(-1).version, 3);
  assert.equal(drafts, 3);
  holdProvider = true;
  const entered = new Promise((resolve) => { providerEntered = resolve; });
  const cancelledResponse = await POST(request());
  await entered;
  await cancelledResponse.body.cancel();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(refunds, 4);
  assert.equal(drafts, 3);
  holdProvider = false;
  oversizedProviderError = true;
  output = await events();
  assert.equal(output.at(-1).type, 'error');
  assert.equal(output.at(-1).code, undefined);
  assert.equal(refunds, 5);
  oversizedProviderError = false;
  oversizedEvent = true;
  output = await events();
  assert.equal(output.at(-1).type, 'error');
  assert.equal(refunds, 6);
  assert.equal(drafts, 3);
  oversizedEvent = false;
  changeOwnerDuringProvider = true;
  const locksBeforeOwnerChange = locks;
  output = await events();
  assert.equal(output.at(-1).code, 'PROJECT_OWNER_CHANGED');
  assert.equal(refunds, 7, 'The abandoned article reservation is refunded');
  assert.equal(drafts, 3, 'An article is not saved to a transferred project');
  assert.equal(locks, locksBeforeOwnerChange + 1, 'The lifecycle lock is acquired before rejecting the save');
  assert.equal(lastRefundTarget, null, 'An account-to-account owner change does not refund another account');
  changeOwnerDuringProvider = false;
  asGuest = true;
  recipeIsTemplate = true;
  changeOwnerDuringProvider = true;
  output = await events();
  assert.equal(output.at(-1).code, 'PROJECT_OWNER_CHANGED');
  assert.equal(claimedIdentity.guestId, 'g1');
  assert.equal(lastRefundTarget, 'u2', 'A claimed guest attempt refunds the transferred account copy');
  assert.equal(refunds, 8);
  assert.equal(drafts, 3);
  changeOwnerDuringProvider = false;
  asGuest = false;
  recipeIsTemplate = false;
  let reservationLocks = 0;
  let reservationQueries = 0;
  let guestProjectClaimed = true;
  let refundSql = '';
  let refundValues = [];
  const reservationDb = {
    $transaction: async (fn) => fn({
      $executeRaw: async () => { reservationLocks++; return 1; },
      interviewProject: { findUnique: async () => ({ userId: guestProjectClaimed ? 'u2' : null, guestId: 'g1' }) },
      $queryRaw: async () => { reservationQueries++; return [{ value: JSON.stringify({ day: '2026-10-05', count: 1 }) }]; },
    }),
    $executeRaw: async (parts, ...values) => { refundSql = parts.join('?'); refundValues = values; return 2; },
  };
  const budget = load('src/lib/interview/article-budget.ts', {
    'node:crypto': require('node:crypto'), '@/lib/prisma': { prisma: reservationDb },
  });
  const guestIdentity = { userId: null, guestId: 'g1', plan: 'GUEST', projectId: 'p1' };
  assert.equal((await budget.claimArticleBudget(guestIdentity)).state, 'owner_changed');
  assert.equal(reservationLocks, 1);
  assert.equal(reservationQueries, 0, 'A claimed project cannot reserve a fresh guest article attempt');
  guestProjectClaimed = false;
  assert.equal((await budget.claimArticleBudget(guestIdentity)).state, 'allowed');
  assert.equal(reservationLocks, 2);
  assert.equal(reservationQueries, 1);
  await budget.refundArticleBudget({ key: 'guest-budget-key', day: '2026-10-05' }, 'u2');
  assert.match(refundSql, /transferDay/);
  assert.match(refundSql, /transferredToUserId/);
  assert(refundValues.includes('u2'));
  let viewerId = null;
  let storedOwner = null;
  const { GET: readRecipe } = load('src/app/api/interview/recipes/[id]/route.ts', {
    'next/server': { NextResponse: Response },
    '@/lib/prisma': { prisma: { interviewRecipe: { findUnique: async () => ({
      id: 'r1', userId: storedOwner, isTemplate: false, isPublic: false, createdAt: new Date(),
    }) } } },
    '@/lib/interview/access': { getInterviewUser: async () => ({ userId: viewerId }), requireDatabase: () => null },
  });
  const context = { params: Promise.resolve({ id: 'r1' }) };
  assert.equal((await readRecipe({}, context)).status, 404, 'A guest cannot read an orphaned private recipe');
  storedOwner = 'other-user';
  viewerId = 'u1';
  assert.equal((await readRecipe({}, context)).status, 404, 'Another account cannot read a private recipe');
  viewerId = 'other-user';
  assert.equal((await readRecipe({}, context)).status, 200, 'The owner can still read the recipe');
  let projectWrites = 0;
  let recipeFound = false;
  let checkedRecipe = false;
  const { PUT: updateProject } = load('src/app/api/interview/projects/[id]/route.ts', {
    'next/server': { NextResponse: Response },
    '@/lib/prisma': { prisma: {
      interviewProject: {
        findUnique: async () => ({ id: 'p1', userId: 'u1', guestId: null }),
        update: async ({ data }) => { projectWrites++; return { id: 'p1', title: 'Test', status: 'DRAFT', updatedAt: new Date(), ...data }; },
      },
      interviewRecipe: { findFirst: async ({ where }) => {
        checkedRecipe = true;
        assert.equal(where.id, 'r1');
        assert.deepEqual(JSON.parse(JSON.stringify(where.OR)), [{ isTemplate: true }, { isPublic: true }, { userId: 'u1' }]);
        return recipeFound ? { id: 'r1' } : null;
      } },
    } },
    '@/lib/interview/access': {
      getInterviewUser: async () => ({ userId: 'u1' }),
      getGuestIdFromRequest: () => null,
      checkOwnership: () => null,
      requireDatabase: () => null,
    },
    '@/lib/interview/storage-purge-queue': { enqueueInterviewProjectStoragePurge: async () => {} },
    '@/lib/interview/thumbnail-storage': { thumbnailUrlForClient: (_id, url) => url },
    '@/lib/interview/transcription-budget': { preserveInterviewTranscriptionUsageBeforeDelete: async () => {} },
  });
  const updateWith = (recipeId) => updateProject({ json: async () => ({ recipeId }) }, { params: Promise.resolve({ id: 'p1' }) });
  assert.equal((await updateWith('r1')).status, 404, 'A foreign private recipe cannot be linked');
  assert.equal(projectWrites, 0);
  assert.equal((await updateWith(42)).status, 400, 'Malformed recipe IDs are rejected');
  assert.equal(projectWrites, 0);
  recipeFound = true;
  assert.equal((await updateWith('r1')).status, 200, 'An accessible recipe can be linked');
  assert.equal(projectWrites, 1);
  checkedRecipe = false;
  assert.equal((await updateWith(null)).status, 200, 'The recipe can be cleared');
  assert.equal(checkedRecipe, false);
  assert.equal(projectWrites, 2);
  console.log('PASS interview article: private recipe access, blocked quota before provider, failed attempt refund, atomic draft save and versioning');
})().catch((error) => { console.error(error); process.exitCode = 1; });
