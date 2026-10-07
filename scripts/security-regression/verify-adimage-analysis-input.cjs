const assert = require('node:assert/strict')
const { load, check } = require('./load-typescript.cjs')
const { readAdImageAnalysisBody: read } = load('src/lib/adimage/analysis-input.ts', {}, {
  TextDecoder, setTimeout: (fn, ms) => { assert.equal(ms, 15000); return setTimeout(fn, 20) }, clearTimeout,
})
const id = '10000000-0000-4000-8000-00000000000A'
const valid = () => ({ operationId: id, url: 'example.test', manualText: '説明'.repeat(25) })
const request = (body, headers) => new Request('https://local.test', { method: 'POST', body: typeof body === 'string' || body instanceof Uint8Array ? body : JSON.stringify(body), headers })
const rejects = (req, status) => assert.rejects(read(req), error => error.status === status)
;(async () => {
  await check('Analysis input canonicalizes one operation ID and URL without truncating user instructions', async () => {
    const value = await read(request({ ...valid(), appeal: '訴求'.repeat(250), objective: '目的'.repeat(50) }))
    assert.equal(value.operationId, id.toLowerCase()); assert.equal(value.url, 'https://example.test/')
    assert.equal(value.appeal.length, 500); assert.equal(value.objective.length, 100); assert.equal(value.manualText.length, 50)
    await read(request({ ...valid(), manualText: 'あ'.repeat(14000) }))
    assert.equal((await read(request({ ...valid(), url: 'HTTP://EXAMPLE.TEST/path' }))).url, 'http://example.test/path')
    for (const url of ['ftp://example.test/file', 'file:///tmp/private', 'https://user:secret@example.test']) await rejects(request({ ...valid(), url }), 400)
  })
  await check('Analysis input refuses missing identity, forged owner and malformed field types', async () => {
    const missing = valid(); delete missing.operationId; await rejects(request(missing), 409)
    for (const patch of [{ operationId: 'not-a-uuid' }, { userId: 'other' }, { manualText: null }, { appeal: {} }, { objective: [] }, { url: '' }, { url: 'https://user:secret@example.test' }, { appeal: 'x'.repeat(501) }, { objective: 'x'.repeat(101) }, { manualText: 'x'.repeat(49) }, { manualText: 'x'.repeat(14001) }]) await rejects(request({ ...valid(), ...patch }), 400)
    for (const raw of ['null', '[]', '{']) await rejects(request(raw), 400)
  })
  await check('Analysis input bounds real UTF8 bytes independently of declared request length', async () => {
    await rejects(request(valid(), { 'content-length': '65537' }), 413)
    await rejects(request(valid(), { 'content-length': '1e3' }), 400)
    await rejects(request({ ...valid(), manualText: 'あ'.repeat(23000) }, { 'content-length': '1' }), 413)
    await rejects(request(new Uint8Array([123, 34, 120, 34, 58, 34, 255, 34, 125])), 400)
  })
  await check('Analysis input cancels stalled and aborted native streams within the reading deadline', async () => {
    for (const aborted of [false, true]) {
      let cancelled = false; const controller = new AbortController()
      const stream = new ReadableStream({ cancel() { cancelled = true } })
      const req = new Request('https://local.test', { method: 'POST', body: stream, duplex: 'half', signal: controller.signal })
      const result = rejects(req, 408); if (aborted) controller.abort(); await result
      assert.equal(cancelled, true)
    }
  })
})().catch(error => { console.error(error); process.exitCode = 1 })
