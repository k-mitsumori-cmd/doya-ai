const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');

let response = Response.json({ candidates: [] });
let rejectFetch = false;
let calls = 0;
const { generateInterviewContent, InterviewGeminiError } = load('src/lib/interview/gemini-request.ts', {}, {
  AbortSignal,
  fetch: async (url, init) => {
    calls++;
    assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent');
    assert.equal(init.headers['x-goog-api-key'], 'private-test-key');
    assert.equal(init.headers['Content-Type'], 'application/json');
    assert.equal(JSON.parse(init.body).contents[0].parts[0].text, 'prompt');
    assert.equal(JSON.parse(init.body).generationConfig.maxOutputTokens, 4096);
    assert.ok(init.signal, 'provider request must have a timeout signal');
    if (rejectFetch) throw new Error('private provider detail');
    return response;
  },
});

(async () => {
  const config = { temperature: 0.3, maxOutputTokens: 4096 };
  assert.deepEqual(JSON.parse(JSON.stringify(await generateInterviewContent('private-test-key', 'gemini-test', 'prompt', config, 50000))), { candidates: [] });
  response = new Response('private provider detail', { status: 503 });
  await assert.rejects(() => generateInterviewContent('private-test-key', 'gemini-test', 'prompt', config, 50000),
    (error) => error instanceof InterviewGeminiError && !error.message.includes('private'));
  rejectFetch = true;
  await assert.rejects(() => generateInterviewContent('private-test-key', 'gemini-test', 'prompt', config, 50000),
    (error) => error instanceof InterviewGeminiError && !error.message.includes('private'));
  assert.equal(calls, 3);
  console.log('PASS interview Gemini: key in header, bounded request, provider details never exposed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
