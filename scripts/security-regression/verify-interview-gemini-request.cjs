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
  response = new Response('x', { headers: { 'Content-Length': String(4 * 1024 * 1024 + 1) } });
  await assert.rejects(() => generateInterviewContent('private-test-key', 'gemini-test', 'prompt', config, 50000),
    (error) => error instanceof InterviewGeminiError && !error.message.includes('large'));
  response = new Response(new ReadableStream({
    start(controller) { controller.enqueue(new Uint8Array(4 * 1024 * 1024 + 1)); controller.close(); },
  }));
  await assert.rejects(() => generateInterviewContent('private-test-key', 'gemini-test', 'prompt', config, 50000),
    (error) => error instanceof InterviewGeminiError && !error.message.includes('large'));
  response = new Response('private provider detail');
  await assert.rejects(() => generateInterviewContent('private-test-key', 'gemini-test', 'prompt', config, 50000),
    (error) => error instanceof InterviewGeminiError && !error.message.includes('private'));
  rejectFetch = true;
  await assert.rejects(() => generateInterviewContent('private-test-key', 'gemini-test', 'prompt', config, 50000),
    (error) => error instanceof InterviewGeminiError && !error.message.includes('private'));
  assert.equal(calls, 6);
  console.log('PASS interview Gemini: key in header, bounded request and response, provider details never exposed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
