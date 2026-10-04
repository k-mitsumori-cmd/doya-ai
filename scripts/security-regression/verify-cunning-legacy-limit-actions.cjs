const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')

const contactUrl = 'https://example.com/contact'
const paths = ['answer', 'prep']

async function run(path, code, upgradeAvailable) {
  let providers = 0
  const api = load(`src/app/api/cunning/${path}/route.ts`, {
    'next/server': { NextResponse: { json: (data, init) => Response.json(data, init) } },
    '@/lib/prisma': { prisma: {} },
    '@/lib/cunning/access': { getUserId: async () => 'owner' },
    '@/lib/cunning/limits': { canStartSession: async () => ({ ok: false, code, reason: '利用上限です', upgradeAvailable }) },
    '@/lib/pricing': { SUPPORT_CONTACT_URL: contactUrl },
    '@/lib/cunning/context': { resolveSessionContext: async () => ({ recordingVersion: 1, status: 'active', mode: 'sales' }) },
    '@/lib/cunning/session-write': {},
    '@/lib/cunning/answer-admission': {},
    '@/lib/cunning/answer': { generateAnswer: async () => { providers++; throw Error('provider should not run') } },
    '@/lib/cunning/rag': {},
    '@/lib/cunning/prep': { generatePrep: async () => { providers++; throw Error('provider should not run') } },
  })
  const request = { json: async () => path === 'answer' ? { sessionId: 'owned', question: '質問' } : { sessionId: 'owned' } }
  const response = await api.POST(request)
  assert.equal(response.status, 403)
  assert.equal(providers, 0)
  return response.json()
}

;(async () => {
  for (const path of paths) {
    const free = await run(path, 'LIMIT', true)
    assert.equal(free.upgradeUrl, '/cunning/pricing')
    assert.equal(free.contactUrl, undefined)
    const paid = await run(path, 'LIMIT', false)
    assert.equal(paid.upgradeUrl, undefined)
    assert.equal(paid.contactUrl, contactUrl)
    const reserved = await run(path, 'RECORDING_RESERVED', false)
    assert.equal(reserved.upgradeUrl, undefined)
    assert.equal(reserved.contactUrl, undefined)
  }
  console.log('PASS Cunning legacy answer and prep return plan-appropriate quota actions without provider calls')
})().catch(error => { console.error(error); process.exitCode = 1 })
