const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')
class BannerTextOperationError extends Error { constructor(status, message) { super(message); this.status = status } }
function fixture(extra = {}) { return load('src/lib/banner/text-http.ts', {
  'node:crypto': require('node:crypto'),
  'next/server': { NextResponse: { json: (value, options) => Response.json(value, options) } },
  './text-budget': {}, './text-operation': { BannerTextOperationError }
}, { TextDecoder, Uint8Array, setTimeout, clearTimeout, ...extra }) }
const request = (body, headers = {}, signal) => new Request('https://local.test', { method: 'POST', body, headers, signal, duplex: 'half' })
;(async () => {
  const http = fixture()
  assert.equal((await http.readBannerTextBody(request('test'), 4)).text, 'test')
  let cancelled = 0
  let result = await http.readBannerTextBody(request(new ReadableStream({ cancel() { cancelled++ } }), { 'content-length': '1000' }), 10)
  assert.equal(result.response.status, 413); await new Promise(setImmediate); assert.equal(cancelled, 1)
  cancelled = 0
  result = await http.readBannerTextBody(request(new ReadableStream({ start(c) { c.enqueue(new Uint8Array(11)) }, cancel() { cancelled++ } })), 10)
  assert.equal(result.response.status, 413); await new Promise(setImmediate); assert.equal(cancelled, 1)
  result = await http.readBannerTextBody(request(new Uint8Array([255])), 10)
  assert.equal(result.response.status, 400)
  for (const mode of ['deadline', 'abort']) {
    let timeout, cleared = 0; cancelled = 0
    const bounded = fixture({ setTimeout: fn => { timeout = fn; return 1 }, clearTimeout: () => { cleared++ } })
    const controller = new AbortController()
    const pending = bounded.readBannerTextBody(request(new ReadableStream({ cancel() { cancelled++ } }), {}, controller.signal), 10)
    if (mode === 'deadline') timeout(); else controller.abort()
    result = await pending
    assert.equal(result.response.status, 408); await new Promise(setImmediate); assert.equal(cancelled, 1); assert.equal(cleared, 1)
    assert.match(result.response.headers.get('cache-control'), /private.*no-store/)
  }
  console.log('PASS6 actual text request reader: exact capacity, declared/stream overflow, invalid UTF8, deadline and abort; no provider/quota side effects')
})().catch(error => { console.error(error); process.exitCode = 1 })
