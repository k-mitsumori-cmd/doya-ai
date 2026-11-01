const assert = require('node:assert/strict')
const { load, check } = require('./load-typescript.cjs')
let supplied, calls, writes, downloads, actor, owned
const valid = () => ({ scores: { visibility: 1, appeal: 2, cta: 3, fit: 4, brand: 5 }, advice: '総評です。', directives: [] })
const feedback = load('src/lib/adimage/feedback.ts', { './vision': { visionJson: async () => { calls++; return supplied } } })
const input = load('src/lib/adimage/feedback-input.ts', { './feedback': feedback }, { TextDecoder, setTimeout: (fn, ms) => { assert.equal(ms, 15000); return setTimeout(fn, 15) }, clearTimeout })
const mocks = {
  'next/server': { NextResponse: Response },
  '@/lib/prisma': { prisma: { adImageConcept: { findFirst: async () => !owned ? null : ({ id: 'concept', copy: { headline: '見出し', sub: '', cta: '詳しく見る' }, creatives: [{ id: 'creative', imagePath: 'synthetic.png', placementKey: 'square' }], campaign: { brand: { name: 'Synthetic' } } }) }, adImageFeedback: { create: async ({data}) => { writes.push(data); return { id: 'feedback' } } } } },
  '@/lib/adimage/access': { getIdentity: async () => ({ userId: actor }), requireUser: () => actor ? ({ ok: true }) : ({ ok: false, reason: 'ログインが必要です。' }), ownerWhere: () => actor ? ({ userId: actor }) : null },
  '@/lib/adimage/feedback': feedback, '@/lib/adimage/feedback-input': input,
  '@/lib/adimage/storage': { downloadBuffer: async () => { downloads++; return Buffer.from('synthetic') } }, '@/lib/adimage/placements': { findPlacement: () => ({ name: 'Square' }) },
}
const {connect,operationId}=require('./adimage-feedback-boundary-fixture.cjs');connect(mocks)
const route = load('src/app/api/adimage/concepts/[id]/feedback/route.ts', mocks)
function reset() { supplied = valid(); calls = 0; writes = []; downloads = 0; actor = 'actor'; owned = true }
const post = (body, headers) => { try { const parsed=JSON.parse(body); if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))body=JSON.stringify({operationId,creativeId:'creative',...parsed}) } catch {} return route.POST(new Request('https://local.test', { method: 'POST', body, headers }), { params: Promise.resolve({ id: 'concept' }) }) }
;(async () => {
  await check('AdImage feedback route never persists or returns fabricated provider grades', async () => {
    for (const value of [null, {}, { ...valid(), scores: {} }, { ...valid(), directives: [{ target: 'copy', instruction: {} }] }]) {
      reset(); supplied = value; const response = await post('{}'); assert.equal(response.status, 503); assert.equal(calls, 1); assert.equal(writes.length, 0)
      const text = await response.text(); assert(!text.includes('scores')); assert(!text.includes('TypeError')); assert.equal(response.headers.get('cache-control'), 'private, no-store')
    }
  })
  await check('AdImage feedback rejects anonymous and initially unowned requests privately before paid work', async () => {
    for (const mode of ['anonymous', 'unowned', 'foreignCreative']) {
      reset(); if (mode === 'anonymous') actor = null; if (mode === 'unowned') owned = false
      const response = await post(JSON.stringify({ creativeId: mode === 'foreignCreative' ? 'foreign' : 'creative' }))
      assert.equal(response.status, mode === 'anonymous' ? 401 : 404); assert.equal(response.headers.get('cache-control'), 'private, no-store'); assert.equal(response.headers.get('vary'), 'Cookie')
      assert.equal(calls, 0); assert.equal(downloads, 0); assert.equal(writes.length, 0); assert(!('feedbackId' in await response.json()))
    }
  })
  await check('AdImage feedback valid route preserves real scores, recomputes total and saves once', async () => {
    reset(); supplied.scores.total = 99; const response = await post(JSON.stringify({ creativeId: 'creative', chips: ['contrast'], note: '見やすく' }))
    assert.equal(response.status, 200); assert.equal(calls, 1); assert.equal(writes.length, 1); assert.equal(writes[0].scores.total, 15); assert.equal(writes[0].source, 'user_chip'); assert.equal((await response.json()).scores.total, 15)
  })
  await check('AdImage feedback invalid request types and unknown fields never reach storage or provider', async () => {
    for (const raw of ['{', 'null', '[]', JSON.stringify({ note: {} }), JSON.stringify({ note: 'x'.repeat(501) }), JSON.stringify({ chips: ['other'] }), JSON.stringify({ chips: ['contrast', 'contrast'] }), JSON.stringify({ chips: 'contrast' }), JSON.stringify({ chips: null }), JSON.stringify({ creativeId: {} }), JSON.stringify({ userId: 'other' })]) {
      reset(); assert.equal((await post(raw)).status, 400); assert.equal(calls, 0); assert.equal(downloads, 0); assert.equal(writes.length, 0)
    }
  })
  await check('AdImage feedback bounds declared and actual body bytes and rejects invalid UTF8', async () => {
    for (const [raw, headers, status] of [['{}', { 'content-length': '8193' }, 413], [JSON.stringify({ note: 'x'.repeat(8193) }), undefined, 413], ['{}', { 'content-length': '1e3' }, 400], [new Uint8Array([123, 34, 120, 34, 58, 34, 255, 34, 125]), undefined, 400]]) {
      reset(); assert.equal((await post(raw, headers)).status, status); assert.equal(calls, 0); assert.equal(writes.length, 0)
    }
  })
  await check('AdImage feedback stalled and aborted request streams cancel without AI execution', async () => {
    for (const aborted of [false, true]) {
      reset(); let cancelled = false; const stream = new ReadableStream({ cancel() { cancelled = true } }); const controller = new AbortController(); if (aborted) controller.abort()
      const request = new Request('https://local.test', { method: 'POST', body: stream, duplex: 'half', signal: controller.signal }); const response = await route.POST(request, { params: Promise.resolve({ id: 'concept' }) })
      assert.equal(response.status, 408); assert.equal(cancelled, true); assert.equal(calls, 0); assert.equal(writes.length, 0)
    }
  })
})().catch(error => { console.error(error); process.exitCode = 1 })
