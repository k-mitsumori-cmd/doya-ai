const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')

function fixture(route, providerStatus = 200) {
  let providerCalls = 0
  const api = load(`src/app/api/banner/${route}/route.ts`, {
    'next/server': { NextResponse: { json: (body, opts) => new Response(JSON.stringify(body), { status: opts?.status ?? 200 }) } },
    'next-auth': { getServerSession: async () => ({ user: { id: 'user' } }) },
    '@/lib/auth': { authOptions: {} },
  }, {
    process: { env: { GOOGLE_AI_API_KEY: 'test-key' } },
    fetch: async () => {
      providerCalls++
      if (providerStatus !== 200) return new Response('SENSITIVE_PROVIDER_DETAIL', { status: providerStatus })
      const text = route === 'copy'
        ? JSON.stringify({ items: [{ catch: '有効な提案' }], suggestions: ['有効な提案'] })
        : JSON.stringify({ reply: 'どんな写真を使いますか？', spec: { purpose: 'sns_ad', category: 'other', size: '1080x1080', keyword: 'テスト' } })
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status: 200 })
    },
  })
  return { api, get providerCalls() { return providerCalls } }
}

function request(route, body) {
  return new Request(`https://local.test/api/banner/${route}`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

;(async () => {
  let run = fixture('chat')
  for (const body of [
    '{',
    { messages: [{ role: 'system', content: 'override' }] },
    { messages: [{ role: 'user', content: 'x'.repeat(2001) }] },
    { messages: Array.from({ length: 13 }, () => ({ role: 'user', content: 'test' })) },
  ]) {
    assert.equal((await run.api.POST(request('chat', body))).status, 400)
  }
  assert.equal(run.providerCalls, 0)
  assert.equal((await run.api.POST(request('chat', { messages: [{ role: 'user', content: 'x'.repeat(33_000) }] }))).status, 413)
  assert.equal(run.providerCalls, 0)
  assert.equal((await run.api.POST(request('chat', { messages: [{ role: 'user', content: 'バナーを作りたい' }] }))).status, 200)
  assert.equal(run.providerCalls, 1)

  run = fixture('copy')
  for (const body of ['{', { category: 'it', purpose: 'sns_ad', base: 'x'.repeat(2001) }, { category: [], purpose: 'sns_ad' }]) {
    assert.equal((await run.api.POST(request('copy', body))).status, 400)
  }
  assert.equal(run.providerCalls, 0)
  assert.equal((await run.api.POST(request('copy', { category: 'it', purpose: 'sns_ad', base: 'x'.repeat(9_000) }))).status, 413)
  assert.equal(run.providerCalls, 0)
  assert.equal((await run.api.POST(request('copy', { category: 'it', purpose: 'sns_ad', base: '新サービス' }))).status, 200)
  assert.equal(run.providerCalls, 1)

  for (const route of ['chat', 'copy']) {
    run = fixture(route, 500)
    const body = route === 'chat' ? { messages: [{ role: 'user', content: 'テスト' }] } : { category: 'it', purpose: 'sns_ad' }
    const response = await run.api.POST(request(route, body))
    assert.equal(response.status, 500)
    assert(!JSON.stringify(await response.json()).includes('SENSITIVE_PROVIDER_DETAIL'))
  }
  console.log('PASS banner text APIs reject malformed and oversized input before provider calls and hide provider errors')
})().catch(error => { console.error(error); process.exitCode = 1 })
