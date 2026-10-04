const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { load } = require('./load-typescript.cjs');

async function main() {
  const helper = load('src/lib/interview/aux-budget.ts', {
    'node:crypto': crypto,
    'next/server': { NextResponse: Response },
    '@/lib/pricing': { SUPPORT_CONTACT_URL: 'https://doyamarke.surisuta.jp/contact' },
    '@/lib/prisma': { prisma: {
      $queryRaw: async () => [{ value: '{"day":"2026-10-01","count":1}' }],
      $executeRaw: async () => 1,
    } },
  });
  assert.equal(helper.interviewAuxDailyLimit('GUEST'), 2);
  assert.equal(helper.interviewAuxDailyLimit('FREE'), 5);
  assert.equal(helper.interviewAuxDailyLimit('LIGHT'), 10);
  assert.equal(helper.interviewAuxDailyLimit('PRO'), 30);
  assert.equal(helper.interviewAuxDailyLimit('ENTERPRISE'), 100);
  const freeLimit = await helper.auxAdmissionError({ state: 'limit', limit: 5 }, 'FREE').json();
  assert.equal(freeLimit.upgradeUrl, '/interview/pricing');
  const paidLimit = await helper.auxAdmissionError({ state: 'limit', limit: 30 }, 'PRO').json();
  assert.equal(paidLimit.contactUrl, 'https://doyamarke.surisuta.jp/contact');
  assert.equal(paidLimit.upgradeUrl, undefined);
  assert.equal((await helper.claimAuxBudget({ userId: 'u1', guestId: null, plan: 'FREE', projectId: 'p1' })).state, 'allowed');

  let guestProjectClaimed = true;
  let guestLocks = 0;
  let guestQueries = 0;
  let transferMarker = false;
  const refundedKeys = [];
  const guestDb = { $transaction: async (fn) => fn({
    $executeRaw: async (parts, ...values) => {
      if (String(parts[0]).includes('pg_advisory_xact_lock')) guestLocks++;
      else refundedKeys.push(values[0]);
      return 1;
    },
    interviewProject: { findUnique: async () => ({ userId: guestProjectClaimed ? 'u2' : null, guestId: 'g1' }) },
    $queryRaw: async () => { guestQueries++; return [{ value: '{"day":"2026-10-01","count":1}' }]; },
    systemSetting: { findUnique: async () => ({ value: JSON.stringify({ day: '2026-10-01', count: 1,
      ...(transferMarker ? { transferDay: '2026-10-01', transferredToUserId: 'u2' } : {}) }) }) },
  }) };
  const guestBudget = load('src/lib/interview/aux-budget.ts', {
    'node:crypto': crypto,
    'next/server': { NextResponse: Response },
    '@/lib/pricing': { SUPPORT_CONTACT_URL: 'https://doyamarke.surisuta.jp/contact' },
    '@/lib/prisma': { prisma: guestDb },
  });
  const guestIdentity = { userId: null, guestId: 'g1', plan: 'GUEST', projectId: 'p1' };
  const stale = await guestBudget.claimAuxBudget(guestIdentity);
  assert.equal(stale.state, 'owner_changed');
  assert.equal(guestQueries, 0, 'A stale guest request must not reserve an auxiliary credit');
  assert.equal(guestBudget.auxAdmissionError(stale, 'GUEST').status, 404);
  guestProjectClaimed = false;
  assert.equal((await guestBudget.claimAuxBudget(guestIdentity)).state, 'allowed');
  assert.equal(guestQueries, 1);
  const guestClaim = { key: 'guest-aux-key', day: '2026-10-01', guestId: 'g1' };
  await guestBudget.refundAuxBudget(guestClaim);
  assert.deepEqual(refundedKeys, ['guest-aux-key']);
  transferMarker = true;
  refundedKeys.length = 0;
  await guestBudget.refundAuxBudget(guestClaim);
  assert.equal(refundedKeys.length, 2, 'A transferred auxiliary failure refunds both guest and account counters');
  assert.equal(refundedKeys[0], 'guest-aux-key');
  assert.equal(refundedKeys[1], `interview-aux:v1:${crypto.createHash('sha256').update('user:u2').digest('hex')}`);
  assert.equal(guestLocks, 4, 'Reservation and refund both serialize with guest ownership transfer');

  let providerCalls = 0;
  let providerFails = true;
  let refunds = 0;
  let includedSettlements = 0;
  let hasPreviousReview = false;
  let projectOwner = 'u1';
  let reviewWrites = 0;
  let admission = { state: 'limit', limit: 5 };
  let included = { state: 'already' };
  const draft = {
    id: 'd1', title: 'Article', content: '記事の本文です。'.repeat(20),
    project: { id: 'p1', userId: 'u1', guestId: null, title: 'Project' },
  };
  const mocks = {
    'next/server': { NextResponse: Response },
    '@/lib/prisma': { prisma: {
      interviewDraft: { findUnique: async () => draft },
      $transaction: async (fn) => fn({
        $executeRaw: async () => 1,
        interviewProject: { findUnique: async () => ({ userId: projectOwner, guestId: null }) },
        interviewReview: { create: async () => { reviewWrites++; return { id: 'review1' }; } },
      }),
      interviewReview: {
        findFirst: async () => hasPreviousReview ? { id: 'review1' } : null,
      },
    } },
    '@/lib/interview/access': {
      getInterviewUser: async () => ({ userId: 'u1', plan: 'FREE' }),
      getGuestIdFromRequest: () => null,
      checkOwnership: (resource, userId) => resource.userId === userId ? null : { status: 404 },
      requireDatabase: () => null,
    },
    '@/lib/interview/gemini-request': {
      InterviewGeminiError: class InterviewGeminiError extends Error {},
      generateInterviewContent: async () => {
        providerCalls++;
        if (providerFails) throw new Error('provider failure');
        return { candidates: [{ content: { parts: [{ text: '{}' }] } }] };
      },
    },
    '@/lib/interview/ai-output': {
      parseProofreadOutput: () => ({ score: 80, summary: '確認しました', suggestions: [], checks: {} }),
      parseFactCheckOutput: () => null,
      parseTitleOutput: () => null,
      parseSnsOutput: () => null,
      parseTranslationOutput: () => null,
    },
    '@/lib/interview/aux-budget': {
      claimAuxBudget: async (identity) => { assert.equal(identity.projectId, 'p1'); return admission; },
      claimIncludedProofread: async () => included,
      auxAdmissionError: ({ limit }) => Response.json({ code: 'INTERVIEW_AUX_LIMIT_REACHED', upgradeUrl: '/interview/pricing', limit }, { status: 429 }),
      refundAuxBudget: async () => { refunds++; },
      refundIncludedProofread: async () => { refunds++; },
      finishIncludedProofread: async () => { includedSettlements++; return true; },
    },
  };
  const globals = { process: { env: { GEMINI_API_KEY: 'local-test-key' } } };
  const routes = [
    ['src/app/api/interview/articles/[id]/proofread/route.ts', {}],
    ['src/app/api/interview/articles/[id]/fact-check/route.ts', {}],
    ['src/app/api/interview/articles/[id]/suggest-titles/route.ts', { platform: 'seo', count: 5 }],
    ['src/app/api/interview/articles/[id]/sns-posts/route.ts', { platforms: ['twitter'] }],
    ['src/app/api/interview/articles/[id]/translate/route.ts', { language: 'en' }],
    ['src/app/api/interview/revise/route.ts', { draftId: 'd1', articleContent: draft.content, instruction: '文章を整えてください' }],
  ];
  for (const [file, body] of routes) {
    const { POST } = load(file, mocks, globals);
    const response = await POST({ json: async () => body }, { params: Promise.resolve({ id: 'd1' }) });
    assert.equal(response.status, 429, file);
    const payload = await response.json();
    assert.equal(payload.code, 'INTERVIEW_AUX_LIMIT_REACHED', file);
    assert.equal(payload.upgradeUrl, '/interview/pricing', file);
  }
  assert.equal(providerCalls, 0, 'No limited request reaches Gemini');
  assert.equal(refunds, 0, 'Denied claims have nothing to refund');

  for (const [file, body] of [
    [routes[2][0], { platform: '__proto__', count: 5 }],
    [routes[3][0], { platforms: ['__proto__'] }],
    [routes[4][0], { language: '__proto__' }],
  ]) {
    const { POST } = load(file, mocks, globals);
    const invalid = await POST({ json: async () => body }, { params: Promise.resolve({ id: 'd1' }) });
    assert.equal(invalid.status, 400, file);
  }
  assert.equal(providerCalls, 0, 'Invalid prototype keys do not reach Gemini');

  const { POST: proofread } = load(routes[0][0], mocks, globals);
  included = { state: 'busy' };
  const busy = await proofread({ json: async () => ({}) }, { params: Promise.resolve({ id: 'd1' }) });
  assert.equal(busy.status, 409);
  assert.equal(providerCalls, 0);

  included = { state: 'already' };
  admission = { state: 'allowed', claim: { key: 'aux', day: '2026-10-01' }, limit: 5 };
  const failed = await proofread({ json: async () => ({}) }, { params: Promise.resolve({ id: 'd1' }) });
  assert.equal(failed.status, 500);
  assert.equal(providerCalls, 1);
  assert.equal(refunds, 1, 'Failed generation refunds the auxiliary claim');

  included = { state: 'allowed', claim: { key: 'included', lease: 'lease1' } };
  providerFails = false;
  const includedSuccess = await proofread({ json: async () => ({}) }, { params: Promise.resolve({ id: 'd1' }) });
  assert.equal(includedSuccess.status, 200);
  assert.equal(includedSettlements, 1);
  assert.equal(refunds, 1, 'The included proofreading does not consume the manual allowance');
  assert.equal(reviewWrites, 1);

  projectOwner = 'u2';
  included = { state: 'already' };
  admission = { state: 'allowed', claim: { key: 'aux', day: '2026-10-01' }, limit: 5 };
  const staleReview = await proofread({ json: async () => ({}) }, { params: Promise.resolve({ id: 'd1' }) });
  assert.equal(staleReview.status, 404, 'Ownership is rechecked before saving a review');
  assert.equal(reviewWrites, 1, 'A transferred project receives no stale guest review');
  assert.equal(refunds, 2);
  projectOwner = 'u1';

  hasPreviousReview = true;
  admission = { state: 'limit', limit: 5 };
  const repeat = await proofread({ json: async () => ({}) }, { params: Promise.resolve({ id: 'd1' }) });
  assert.equal(repeat.status, 429, 'A saved review makes the next proofreading an auxiliary request');
  assert.equal(providerCalls, 3);

  console.log('PASS interview auxiliary limits reject before AI, included proofread blocks overlap, and failure refunds');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
