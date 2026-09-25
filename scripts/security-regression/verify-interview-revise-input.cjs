const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');

let providerCalls = 0;
let lastPrompt = '';
let providerText = '修正後の記事';
const { POST } = load('src/app/api/interview/revise/route.ts', {
  'next/server': { NextResponse: Response },
  '@/lib/prisma': { prisma: { interviewDraft: { findUnique: async () => ({
    id: 'draft-1', project: { userId: 'user-1', guestId: null },
  }) } } },
  '@/lib/interview/access': {
    getInterviewUser: async () => ({ userId: 'user-1' }),
    getGuestIdFromRequest: () => null,
    checkOwnership: () => null,
    requireDatabase: () => null,
  },
  '@/lib/interview/gemini-request': {
    InterviewGeminiError: class InterviewGeminiError extends Error {},
    generateInterviewContent: async (_key, _model, prompt) => {
      providerCalls++;
      lastPrompt = prompt;
      return { candidates: [{ content: { parts: [{ text: providerText }] } }] };
    },
  },
}, { process: { env: { GEMINI_API_KEY: 'test-key' } } });

const revise = (articleContent, instruction) => POST({
  json: async () => ({ draftId: 'draft-1', articleContent, instruction }),
});

(async () => {
  let response = await revise('本文'.repeat(30001), '修正して');
  assert.equal(response.status, 400);
  assert.equal(providerCalls, 0);

  response = await revise('本文です。'.repeat(10), '指示'.repeat(2001));
  assert.equal(response.status, 400);
  assert.equal(providerCalls, 0);

  const fullArticle = '本文'.repeat(30000);
  response = await revise(fullArticle, '修正して');
  assert.equal(response.status, 200);
  assert.equal(providerCalls, 1);
  assert.ok(lastPrompt.endsWith(fullArticle), 'The accepted article reaches the provider in full');

  providerText = '```markdown\n```';
  response = await revise('本文です。'.repeat(10), '修正して');
  assert.equal(response.status, 500, 'An empty fenced response is not presented as a successful edit');
  console.log('PASS interview revise: oversized input rejected before provider, full accepted article preserved, empty result rejected');
})().catch((error) => { console.error(error); process.exitCode = 1; });
