// Real SDK serialization; every HTTP request terminates in the supplied fake fetch.
const assert = require('node:assert/strict');
const native = require('openai');
const OpenAI = native.default || native;
const { load, check, results } = require('./load-typescript.cjs');

function fixture(reply, env = {}) {
  const requests = [], options = [];
  class OfflineOpenAI extends OpenAI {
    constructor(input) {
      assert.equal(input.apiKey, 'SYNTHETIC_OFFLINE_KEY');
      options.push(input);
      super({ ...input, organization: null, project: null, fetch: async (url, init) => {
        assert.equal(new URL(String(url)).origin, 'https://api.openai.com');
        assert.equal(new Headers(init.headers).get('authorization'), 'Bearer SYNTHETIC_OFFLINE_KEY');
        requests.push({ url: String(url), ...init });
        return reply(requests.length, init);
      } });
    }
  }
  const sdk = { __esModule: true, default: OfflineOpenAI, toFile: native.toFile };
  const globals = { process: { env: { OPENAI_API_KEY: 'SYNTHETIC_OFFLINE_KEY', ...env } } };
  const text = () => load('src/lib/openai.ts', { openai: sdk }, globals);
  const aio = () => load('src/lib/aio/engines.ts', {
    openai: sdk, '@seo/lib/gemini': { geminiGenerateText: () => { throw Error('Unexpected provider'); }, GEMINI_TEXT_MODEL_DEFAULT: 'unused' },
  }, globals);
  const image = () => load('src/lib/openai-image.ts', {
    openai: sdk, './fetch-timeout': { withTimeout: (_label, _ms, fn) => fn(new AbortController().signal) },
  }, globals);
  return { requests, options, text, aio, image };
}
const answer = () => Response.json({ choices: [{ message: { content: '検査用の回答' } }] });
const imageAnswer = () => Response.json({ data: [{ b64_json: 'Zml4dHVyZQ==' }] });
const failure = status => Response.json({ error: { message: 'Synthetic failure', type: 'audit', code: 'audit' } }, { status });
const input = { prompt: '検査', images: [{ base64: Buffer.from('first').toString('base64'), mimeType: 'image/png' }] };

(async () => {
  await check('real SDK preserves text model, substitution and Japanese output', async () => {
    const f = fixture(answer), result = await f.text().generateText('こんにちは{{name}}', { name: '検査' });
    assert.equal(result, '検査用の回答'); assert.equal(f.requests.length, 1);
    const body = JSON.parse(f.requests[0].body);
    assert.equal(body.model, 'gpt-4o'); assert.equal(body.max_tokens, 4000);
    assert.equal(body.messages[1].content, 'こんにちは検査');
    assert.ok(f.requests[0].url.endsWith('/chat/completions'));
  });
  await check('real SDK preserves AIO grounding and citations', async () => {
    const f = fixture(answer), result = await f.aio().askEngine('chatgpt', '質問', { groundingHits: [
      { title: '見本', link: 'https://example.invalid/source', domain: 'example.invalid', snippet: '検査用の根拠' },
    ] });
    assert.equal(result.text, '検査用の回答'); assert.equal(result.citations.join(','), 'https://example.invalid/source');
    const body = JSON.parse(f.requests[0].body);
    assert.equal(body.model, 'gpt-4o'); assert.equal(body.max_tokens, 700);
    assert.ok(body.messages[1].content.includes('検査用の根拠'));
  });
  await check('real toFile and SDK multipart preserve reference bytes and edit fields', async () => {
    const f = fixture(imageAnswer), result = await f.image().editImageGpt({ ...input, images: [...input.images,
      { base64: Buffer.from('second').toString('base64'), mimeType: 'image/jpeg' },
    ], size: '1280x720', quality: 'auto' });
    assert.equal(result.b64, 'Zml4dHVyZQ=='); assert.equal(result.model, 'gpt-image-2');
    assert.equal(f.options[0].maxRetries, 0); assert.equal(f.requests.length, 1);
    const body = f.requests[0].body, images = body.getAll('image[]');
    assert.equal(images.length, 2); assert.equal(images[0].name, 'reference-1.png');
    assert.equal(images[1].name, 'reference-2.jpg'); assert.equal(images[1].type, 'image/jpeg');
    assert.equal(Buffer.from(await images[0].arrayBuffer()).toString(), 'first');
    assert.equal(body.get('size'), '1536x1024'); assert.equal(body.get('quality'), 'medium');
    assert.equal(body.get('background'), 'opaque'); assert.equal(body.get('n'), '1');
  });
  for (const status of [429, 500, 503]) await check(`real SDK ${status}: one primary request and one permitted fallback`, async () => {
    const f = fixture(index => index === 1 ? failure(status) : imageAnswer());
    assert.equal((await f.image().editImageGpt(input)).model, 'gpt-image-1');
    assert.equal(f.requests.length, 2); assert.equal(f.requests[0].body.get('model'), 'gpt-image-2');
    assert.equal(f.requests[1].body.get('model'), 'gpt-image-1');
    assert.equal(f.options[0].maxRetries, 0);
  });
  await check('real SDK 400 never retries or changes model', async () => {
    const f = fixture(() => failure(400)); await assert.rejects(f.image().editImageGpt(input));
    assert.equal(f.requests.length, 1);
  });
  await check('real SDK network failure never retries or changes model', async () => {
    const f = fixture(() => { throw Error('Synthetic disconnected transport'); });
    await assert.rejects(f.image().editImageGpt(input)); assert.equal(f.requests.length, 1);
  });
  await check('empty successful image response never starts a fallback', async () => {
    const f = fixture(() => Response.json({ data: [] }));
    await assert.rejects(f.image().editImageGpt(input), /no image data/); assert.equal(f.requests.length, 1);
  });
  await check('configured fallback model is never submitted twice', async () => {
    const f = fixture(() => failure(429), { OPENAI_IMAGE_EDIT_MODEL: 'gpt-image-1' });
    await assert.rejects(f.image().editImageGpt(input)); assert.equal(f.requests.length, 1);
  });
  console.log(JSON.stringify({ passed: results.length, results, scope: 'Real SDK and application functions; synthetic key and injected HTTP only. No network, real credentials, providers or DB.' }));
})().catch(error => { console.error(error); process.exitCode = 1; });
