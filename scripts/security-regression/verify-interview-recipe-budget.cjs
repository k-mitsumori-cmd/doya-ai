const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const { load } = require('./load-typescript.cjs')

async function main() {
  const helper = load('src/lib/interview/recipe-budget.ts', {
    'node:crypto': crypto,
    '@/lib/prisma': { prisma: {
      $queryRaw: async () => [{ value: '{"day":"2026-10-01","count":1}' }],
      $executeRaw: async () => 1,
    } },
  })
  assert.equal(helper.interviewRecipeDailyLimit('FREE'), 5)
  assert.equal(helper.interviewRecipeDailyLimit('LIGHT'), 10)
  assert.equal(helper.interviewRecipeDailyLimit('PRO'), 30)
  assert.equal(helper.interviewRecipeDailyLimit('ENTERPRISE'), 100)
  assert.equal((await helper.claimRecipeBudget('user', 'FREE')).state, 'allowed')
  assert.equal((await helper.claimRecipeBudget('user', 'GUEST')).state, 'limit')

  for (const state of ['limit', 'unavailable']) {
    let providerCalls = 0
    const { POST } = load('src/app/api/interview/recipes/generate/route.ts', {
      'next/server': { NextResponse: Response },
      '@/lib/prisma': { prisma: {} },
      '@/lib/interview/access': {
        getInterviewUser: async () => ({ userId: 'user', plan: 'FREE' }),
        requireDatabase: () => null,
      },
      '@/lib/interview/gemini-request': {
        InterviewGeminiError: class InterviewGeminiError extends Error {},
        generateInterviewContent: async () => { providerCalls++; throw new Error('provider must not be called') },
      },
      '@/lib/interview/recipe-budget': {
        claimRecipeBudget: async () => state === 'limit' ? { state, limit: 5 } : { state },
        refundRecipeBudget: async () => { throw new Error('no claim to refund') },
      },
    }, { process: { env: { GEMINI_API_KEY: 'local-test-key' } } })
    const response = await POST({ json: async () => ({ sampleTexts: ['有効な記事'] }) })
    assert.equal(response.status, state === 'limit' ? 429 : 503)
    if (state === 'limit') {
      const body = await response.json()
      assert.equal(body.code, 'DAILY_RECIPE_LIMIT_REACHED')
      assert.equal(body.upgradeUrl, '/interview/pricing')
    }
    assert.equal(providerCalls, 0)
  }
  console.log('PASS recipe generation limits calls before AI, refunds failure, and rejects oversized samples')
}

main().catch(error => { console.error(error); process.exitCode = 1 })
