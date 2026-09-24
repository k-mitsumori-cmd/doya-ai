const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');

let providerCalls = 0;
let saved = 0;
let modelResult = { name: 'Sample', category: 'interview', structure: [{ section: '導入', wordCount: 200 }] };
const { POST } = load('src/app/api/interview/recipes/generate/route.ts', {
  'next/server': { NextResponse: Response },
  '@/lib/prisma': { prisma: { interviewRecipe: { create: async () => { saved++; return {}; } } } },
  '@/lib/interview/access': {
    getInterviewUser: async () => ({ userId: 'user' }),
    requireDatabase: () => null,
  },
  '@/lib/interview/gemini-request': {
    InterviewGeminiError: class InterviewGeminiError extends Error {},
    generateInterviewContent: async (apiKey) => {
      assert.equal(apiKey, 'test-key');
      providerCalls++;
      return { candidates: [{ content: { parts: [{ text: JSON.stringify(modelResult) }] } }] };
    },
  },
}, {
  process: { env: { GEMINI_API_KEY: 'test-key' } },
});
const request = (body) => ({ json: async () => body });

(async () => {
  for (const bad of [null, [], {}, { sampleTexts: 'text' }, { sampleTexts: [123] },
    { sampleTexts: [] }, { sampleTexts: Array(4).fill('text') },
    { sampleTexts: ['text'], name: {} }, { sampleTexts: ['text'], autoSave: 'false' },
    { sampleTexts: ['text'], name: 'x'.repeat(201) }]) {
    const response = await POST(request(bad));
    assert.equal(response.status, 400, JSON.stringify(bad));
  }
  assert.equal(providerCalls, 0, 'invalid recipe input must not call the paid AI provider');
  assert.equal(saved, 0);

  const response = await POST(request({ sampleTexts: ['', 'sample article'], category: 'custom', autoSave: false }));
  assert.equal(response.status, 200);
  const preview = (await response.json()).recipe;
  assert.equal(preview.name, 'Sample');
  assert.equal(preview.category, 'custom', 'preview category must match the category saved by the UI');
  assert.equal(preview.structure[0].section, '導入');
  assert.equal(providerCalls, 1);
  assert.equal(saved, 0, 'preview must not persist a recipe');

  modelResult = { name: { invalid: true }, description: { invalid: true },
    structure: [{ section: { invalid: true } }], editingGuidelines: [] };
  const malformed = await POST(request({ sampleTexts: ['sample article'] }));
  assert.equal(malformed.status, 502, 'malformed AI output must not reach the preview');
  assert.equal(saved, 0);

  modelResult = { name: 'Safe', description: { invalid: true },
    structure: [{ section: '本文', wordCount: 'many' }, { section: { invalid: true } }] };
  const mixed = await POST(request({ sampleTexts: ['sample article'] }));
  assert.equal(mixed.status, 200);
  const safe = (await mixed.json()).recipe;
  assert.equal(safe.description, '');
  assert.deepEqual(safe.structure, [{ section: '本文', description: '', wordCount: null }]);
  console.log('PASS interview recipe: invalid input rejected before AI and preview stays unsaved');
})().catch((error) => { console.error(error); process.exitCode = 1; });
