const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');

let providerCalls = 0;
let saved = 0;
const { POST } = load('src/app/api/interview/recipes/generate/route.ts', {
  'next/server': { NextResponse: Response },
  '@/lib/prisma': { prisma: { interviewRecipe: { create: async () => { saved++; return {}; } } } },
  '@/lib/interview/access': {
    getInterviewUser: async () => ({ userId: 'user' }),
    requireDatabase: () => null,
  },
}, {
  process: { env: { GEMINI_API_KEY: 'test-key' } },
  fetch: async () => {
    providerCalls++;
    return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify({ name: 'Sample', structure: [] }) }] } }] });
  },
});
const request = (body) => ({ json: async () => body });

(async () => {
  for (const bad of [null, [], {}, { sampleTexts: 'text' }, { sampleTexts: [123] },
    { sampleTexts: [] }, { sampleTexts: Array(4).fill('text') },
    { sampleTexts: ['text'], name: {} }, { sampleTexts: ['text'], autoSave: 'false' }]) {
    const response = await POST(request(bad));
    assert.equal(response.status, 400, JSON.stringify(bad));
  }
  assert.equal(providerCalls, 0, 'invalid recipe input must not call the paid AI provider');
  assert.equal(saved, 0);

  const response = await POST(request({ sampleTexts: ['', 'sample article'], autoSave: false }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).recipe.name, 'Sample');
  assert.equal(providerCalls, 1);
  assert.equal(saved, 0, 'preview must not persist a recipe');
  console.log('PASS interview recipe: invalid input rejected before AI and preview stays unsaved');
})().catch((error) => { console.error(error); process.exitCode = 1; });
