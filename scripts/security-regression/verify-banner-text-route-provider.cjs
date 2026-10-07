const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')
;(async () => {
  let cases = 0
  for (const kind of ['chat', 'copy']) {
    for (const mode of ['network', 'server503', 'invalid', 'success']) {
      let calls = 0, admissions = 0
      const answer = load('src/lib/banner/text-answer.ts', {
        './provider-response': { requestBannerTextProvider: async () => {
          calls++
          if (mode === 'network') throw Error('Synthetic uncertain response')
          if (mode === 'server503') return { ok: false, status: 503, text: 'Synthetic failure' }
          if (mode === 'invalid') return { ok: true, status: 200, text: 'not JSON' }
          const text = JSON.stringify(kind === 'chat' ? { reply: 'どんな写真を使いますか？', spec: { purpose: 'sns_ad', category: 'other', size: '1080x1080', keyword: 'テスト' } } : { suggestions: ['テスト用のコピーです'] })
          return { ok: true, status: 200, text: JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }) }
        } }
      })
      const route = load(`src/app/api/banner/${kind}/route.ts`, {
        'next/server': { NextResponse: { json: (value, options) => Response.json(value, options) } },
        'next-auth': { getServerSession: async () => ({ user: { id: 'synthetic-actor' } }) },
        '@/lib/auth': { authOptions: {} },
        '@/lib/banner/text-answer': answer,
        '@/lib/banner/text-http': require('./banner-text-http-fixture.cjs').textHttpFixture(async () => { admissions++; return { state: 'allowed' } })
      }, { process: { env: { GOOGLE_AI_API_KEY: 'synthetic' } } })
      const body = kind === 'chat' ? { messages: [{ role: 'user', content: 'バナーを作りたいです' }] } : { category: 'other', purpose: 'sns_ad' }
      const response = await route.POST(new Request(`https://local.test/api/banner/${kind}`, { method: 'POST', body: JSON.stringify(body) }))
      assert.equal(calls, 1, `${kind}/${mode} must invoke provider once`)
      assert.equal(admissions, 1)
      assert.equal(response.status, mode === 'success' ? 200 : 500)
      const result = await response.json()
      assert.equal(JSON.stringify(result).includes('synthetic'), false)
      if (mode === 'success') assert(kind === 'chat' ? result.reply : result.suggestions.length)
      cases++
    }
  }
  console.log(`PASS${cases} actual chat/copy routes and shared answer: uncertain network,503,invalid output never repeat provider; synthetic session/budget/provider only. Actual HTTP operation orchestration included with synthetic receipt/budget; real PostgreSQL checked separately.`)
})().catch(error => { console.error(error); process.exitCode = 1 })
