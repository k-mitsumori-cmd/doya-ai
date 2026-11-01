const fs = require('node:fs'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const { load } = require('../../../scripts/security-regression/load-typescript.cjs');
const scope='a'.repeat(64),operationId='10000000-0000-4000-8000-000000000001';
const protocol=load('src/lib/interview/article-operation-client.ts',{}, {AbortController,TextDecoder,Uint8Array,setTimeout,clearTimeout});
const base = 'docs/audits/2026-10-06-all-services-recheck/', file = 'src/lib/interview/article-stream-client.ts', cases = [];
const event = row => 'data: ' + JSON.stringify(row) + '\n\n';
const completed = { type: 'done', draftId: 'draft', wordCount: 2, version: 1 };
const response = text => new Response(text, { headers: { 'content-type': 'text/event-stream; charset=utf-8', 'x-article-operation-id':operationId,'x-article-actor-scope':scope } });
function fixture(reply) {
  let sequence = 0; const timers = new Map(), calls = [], events = [];
  const api = load(file, {'./article-operation-client':protocol}, { AbortController, TextDecoder, Uint8Array, fetch: (url, init) => { calls.push({ url, init }); return reply() },
    setTimeout: (fn, ms) => { assert.equal(ms, 310000); timers.set(++sequence, fn); return sequence }, clearTimeout: id => timers.delete(id) });
  return { api, calls, timers, events, run: (signal = new AbortController().signal) => api.readArticleGeneration({ projectId: 'project', recipeId: 'recipe', displayFormat: 'MONOLOGUE',operationId,actorScope:scope }, signal, e => events.push(e)), expire: () => [...timers.values()].forEach(fn => fn()) };
}
async function check(name, run) { await run(); cases.push(name) }
(async () => {
  await check('Valid stream emits ordered progress and text and accepts saved draft', async () => {
    const f = fixture(async () => response(event({ type: 'progress', step: '保存中' }) + event({ type: 'chunk', text: '日本' }) + event(completed)));
    assert.equal((await f.run()).draftId, 'draft'); assert.equal(f.events.length, 3); assert.equal(f.timers.size, 0); assert(f.calls[0].init.signal.aborted); assert.equal(f.calls.length, 1);
  });
  await check('First terminal completion ignores duplicate completions, errors and further chunks', async () => {
    const f = fixture(async () => response(event(completed) + event(completed) + event({ type: 'error', message: 'late' }) + event({ type: 'chunk', text: 'late' })));
    assert.equal((await f.run()).type, 'done'); assert.equal(f.events.length, 1);
  });
  await check('Quota terminal preserves upgrade/contact metadata and stops before later completion', async () => {
    const f = fixture(async () => response(event({ type: 'error', code: 'ARTICLE_LIMIT', message: '本日の上限', upgradePath: '/interview/pricing', contactUrl: '/contact' }) + event(completed)));
    assert.equal((await f.run()).code, 'ARTICLE_LIMIT'); assert.equal(f.events.length, 1);
  });
  await check('Fragmented UTF8 and CRLF, comments and multiline data remain valid', async () => {
    const bytes = new TextEncoder().encode(': heartbeat\r\n\r\ndata: {"type":"chunk",\r\ndata: "text":"日本"}\r\n\r\n' + event(completed).replaceAll('\n', '\r\n'));
    const f = fixture(async () => response(new ReadableStream({ start(c) { for (const b of bytes) c.enqueue(Uint8Array.of(b)); c.close() } })));
    assert.equal((await f.run()).type, 'done'); assert.equal(f.events[0].text, '日本');
  });
  for (const [name, body] of [
    ['invalid JSON', 'data: {\n\n'], ['array payload', event([])], ['unknown event', event({ type: 'surprise' })],
    ['missing draft', event({ type: 'done', wordCount: 2 })], ['unsafe draft', event({ ...completed, draftId: '../private' })],
    ['invalid count', event({ ...completed, wordCount: -1 })], ['invalid version', event({ ...completed, version: 0 })],
    ['invalid chunk', event({ type: 'chunk', text: {} })], ['oversized progress', event({ type: 'progress', step: 'x'.repeat(2001) })],
    ['truncated terminal', event(completed).trimEnd()], ['EOF before saved acknowledgement', event({ type: 'chunk', text: 'partial' })],
  ]) await check('Reject ' + name + ' without completed side effect', async () => {
    const f = fixture(async () => response(body)); await assert.rejects(f.run(), e => e.kind === 'unknown'); assert.equal(f.events.filter(e => e.type === 'done').length, 0); assert.equal(f.timers.size, 0);
  });
  await check('Missing/wrong content type and excessive content length fail closed', async () => {
    for (const headers of [{}, { 'content-type': 'application/json' }, { 'content-type': 'text/event-stream', 'content-length': String(8 * 1024 * 1024 + 1) }]) {
      const f = fixture(async () => new Response(event(completed), { headers })); await assert.rejects(f.run(), e => e.kind === 'unknown'); assert.equal(f.events.length, 0);
    }
  });
  await check('Malformed UTF8 is rejected', async () => { const f = fixture(async () => response(Uint8Array.of(0xff))); await assert.rejects(f.run(), e => e.kind === 'unknown') });
  await check('Event and accumulated article bounds cancel the body', async () => {
    for (const body of ['data: ' + 'x'.repeat(512 * 1024), event({ type: 'chunk', text: 'x'.repeat(300000) }) + event({ type: 'chunk', text: 'x'.repeat(300000) })]) {
      let cancelled = 0; const f = fixture(async () => response(new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(body)) }, cancel() { cancelled++ } })));
      await assert.rejects(f.run(), e => e.kind === 'unknown'); assert.equal(cancelled, 1);
    }
  });
  await check('Total byte bound handles repeated valid small events', async () => {
    const f = fixture(async () => response((': heartbeat\n\n').repeat(650000)));
    await assert.rejects(f.run(), e => e.kind === 'unknown'); assert.equal(f.events.length, 0);
  });
  await check('401 is login; other HTTP errors never expose raw diagnostic', async () => {
    for (const status of [401, 429, 500]) { const f = fixture(async () => new Response('PRIVATE', { status })); await assert.rejects(f.run(), e => e.kind === (status === 401 ? 'login' : 'unknown') && !e.message.includes('PRIVATE')) }
  });
  await check('Header stall deadline bounds abort-ignoring fetch with no resend', async () => {
    const f = fixture(() => new Promise(() => {})), p = assert.rejects(f.run(), e => e.kind === 'unknown'); f.expire(); await p; assert.equal(f.calls.length, 1); assert.equal(f.timers.size, 0);
  });
  await check('Body stall uses the same total deadline and cancels reader', async () => {
    let cancelled = 0; const f = fixture(async () => response(new ReadableStream({ pull() { return new Promise(() => {}) }, cancel() { cancelled++ } })));
    const p = assert.rejects(f.run(), e => e.kind === 'unknown'); await new Promise(r => setImmediate(r)); f.expire(); await p; assert.equal(cancelled, 1); assert.equal(f.timers.size, 0);
  });
  await check('Parent abort bounds noncooperative fetch and rejects late completion', async () => {
    let finish; const f = fixture(() => new Promise(r => finish = r)), c = new AbortController(), p = assert.rejects(f.run(c.signal), e => e.kind === 'cancelled');
    c.abort(); await p; finish(response(event(completed))); await new Promise(r => setImmediate(r)); assert.equal(f.events.length, 0); assert.equal(f.timers.size, 0);
  });
  await check('Pre-aborted signal never starts transport', async () => { const f = fixture(async () => response(event(completed))), c = new AbortController(); c.abort(); await assert.rejects(f.run(c.signal), e => e.kind === 'cancelled'); assert.equal(f.calls.length, 0) });
  await check('Completed JSON replay returns saved receipt without synthesizing fresh done', async () => {
    const row = {operationId, actorScope:scope, state:'completed', result:{draftId:'saved',wordCount:2,version:1},code:null,limit:5};
    const f = fixture(async () => Response.json(row)); const result = await f.run();
    assert.equal(result.type,'operation'); assert.equal(result.operation.result.draftId,'saved'); assert.equal(f.events.length,1); assert.equal(f.events[0].type,'operation'); assert.equal(f.calls.length,1);
  });
  await check('JSON quota and pending receipts remain typed operations without retries', async () => {
    for (const [state,status,extra] of [['failed',429,{code:'ARTICLE_LIMIT',message:'本日の上限',upgradePath:'/interview/pricing'}],['pending',202,{}],['cancelling',202,{}],['busy',409,{limit:null}]]) {
      const f = fixture(async () => Response.json({operationId,actorScope:scope,state,result:null,code:null,limit:5,...extra},{status}));
      assert.equal((await f.run()).operation.state,state); assert.equal(f.events.length,1); assert.equal(f.calls.length,1);
    }
  });
  await check('JSON receipt from another actor or operation never emits any event', async () => {
    for (const changed of [{actorScope:'b'.repeat(64)},{operationId:'10000000-0000-4000-8000-000000000002'}]) {
      const f=fixture(async()=>Response.json({operationId,actorScope:scope,state:'pending',result:null,code:null,limit:5,...changed},{status:202}));
      await assert.rejects(f.run()); assert.equal(f.events.length,0);
    }
  });
  await check('Streaming acknowledgement requires matching actor and UUID headers', async () => {
    for (const changed of [{'x-article-actor-scope':'b'.repeat(64)},{'x-article-operation-id':'10000000-0000-4000-8000-000000000002'},{'x-article-actor-scope':''}]) {
      const f=fixture(async()=>new Response(event(completed),{headers:{'content-type':'text/event-stream','x-article-operation-id':operationId,'x-article-actor-scope':scope,...changed}}));
      await assert.rejects(f.run(),e=>e.kind==='unknown'); assert.equal(f.events.length,0);
    }
  });
  await check('Completion without version cannot trigger a done side effect', async () => {
    const f=fixture(async()=>response(event({type:'done',draftId:'draft',wordCount:2})));await assert.rejects(f.run(),e=>e.kind==='unknown');assert.equal(f.events.length,0);
  });
  await check('JSON body stall stays within the same POST deadline without resend', async () => {
    let cancelled=0;const f=fixture(async()=>new Response(new ReadableStream({pull(){return new Promise(()=>{})},cancel(){cancelled++}}),{status:202,headers:{'content-type':'application/json'}}));
    const pending=assert.rejects(f.run(),e=>e.kind==='unknown'); await new Promise(r=>setImmediate(r));f.expire();await pending;assert.equal(cancelled,1);assert.equal(f.calls.length,1);assert.equal(f.timers.size,0);
  });
  assert.equal(cases.length, 30);
  const files = [file, 'src/lib/interview/article-operation-client.ts', base + 'verify-interview-article-stream-client.cjs'];
  const report = { checkedAt: new Date().toISOString(), passed: cases.length, cases, sourceHashes: Object.fromEntries(files.map(p => [p, crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')])), scope: 'Actual client reader with native Response streams, UTF8 and AbortController; controlled timers/fetch. Not UI, native browser, server receipt, provider or database verification.' };
  fs.writeFileSync(base + 'interview-article-stream-client-results.json', JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1 });
