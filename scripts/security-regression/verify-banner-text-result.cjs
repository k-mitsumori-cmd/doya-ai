const assert = require('node:assert/strict'), crypto = require('node:crypto')
const { load } = require('./load-typescript.cjs')
const helper = load('src/lib/banner/text-operation.ts', { 'node:crypto': crypto, '@/lib/prisma': { prisma: {} }, './text-budget': {} })
;(async () => {
  let cases = 0
  for (const [kind, payload] of [
    ['chat', { reply: 'x'.repeat(4001) }], ['chat', { reply: 42 }], ['chat', {}],
    ['chat', { reply: '返信です？', spec: { size: 10 } }],
    ['chat', { reply: '返信です？', spec: { purpose: 'sns_ad', category: 'other', keyword: 'テスト', size: '9999x9999' } }],
    ['chat', { reply: '返信です？', questions: [42] }], ['chat', { reply: '返信です？', suggestions: ['x'.repeat(2001)] }],
    ['copy', { suggestions: ['x'.repeat(2001)] }], ['copy', { suggestions: [] }], ['copy', { suggestions: [42] }],
    ['copy', { suggestions: Array.from({ length: 13 }, () => '有効な案') }], ['chat', null]
  ]) {
    let saves = 0, failed = 0, calls = 0
    const http = load('src/lib/banner/text-http.ts', {
      'node:crypto': crypto, 'next/server': { NextResponse: { json: (body, options) => Response.json(body, options) } }, './text-budget': {},
      './text-operation': { ...helper, beginBannerTextOperation: async () => ({ state: 'started' }), completeBannerTextOperation: async () => { saves++; throw Error('Invalid output must not attempt storage') }, failBannerTextOperation: async () => { failed++; return 'failed' } }
    })
    const response = await http.runBannerTextOperation('synthetic', kind, '10000000-0000-4000-8000-000000000001', {}, async () => { calls++; return payload === null ? new Response('{') : Response.json(payload) })
    assert.equal(response.status, 502); assert.equal((await response.json()).state, 'failed')
    assert.equal(saves, 0); assert.equal(failed, 1); assert.equal(calls, 1); cases++
  }
  assert(helper.isValidBannerTextResult({ reply: '有効な返信です？', spec: { purpose: 'sns_ad', category: 'other', keyword: 'テスト', size: '320x50', brandColors: ['#123ABC'] }, suggestions: ['有効な案'] }, 'chat')); cases++
  assert(helper.isValidBannerTextResult({ suggestions: ['有効な案'] }, 'copy')); cases++
  console.log(`PASS${cases} actual result validation and HTTP orchestration: invalid answer closes failed before storage; no provider repeat or permanent pending. Valid320x50 accepted.`)
})().catch(error => { console.error(error); process.exitCode = 1 })
