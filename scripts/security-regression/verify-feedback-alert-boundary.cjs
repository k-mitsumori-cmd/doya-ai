const assert = require('node:assert/strict')
const { load, check } = require('./load-typescript.cjs')

const privateKey = 'PRIVATE_TOKEN=do-not-log'

function fixture(body, notifyAlert) {
  const saves = []
  const slackPosts = []
  const route = load('src/app/api/feedback/route.ts', {
    'next/server': { NextResponse: { json: (value, options) => ({ status: options?.status || 200, body: value }) } },
    'next-auth': { getServerSession: async () => ({ user: { id: 'test-user' } }) },
    '@/lib/auth': { authOptions: {} },
    '@/lib/prisma': { prisma: {
      serviceFeedback: { create: async (args) => { saves.push(args); return { id: 'feedback-1' } } },
      user: { findUnique: async () => ({ name: 'Test User', email: null }) },
    } },
    '@/lib/notifications': { postToSlackBlocks: async (...args) => { slackPosts.push(args) } },
    '@/lib/alert': { notifyAlert },
    '@/lib/attribution': { serviceLabelOf: (id) => id },
    '@/lib/html-escape': { escapeHtml: (value) => value },
    '@/lib/feedback': { markPromptShown: async () => {}, optOutPrompt: async () => {}, shouldPromptFeedback: async () => ({ show: false }), snoozePrompt: async () => {} },
  })
  return { route, saves, slackPosts, request: { json: async () => body, url: 'https://doya.invalid/api/feedback' } }
}

;(async () => {
  await check('Unknown feedback form waits for its alert and hides private key names', async () => {
    let finishAlert
    let alertStarted
    const started = new Promise((resolve) => { alertStarted = resolve })
    const alerts = []
    const f = fixture({ serviceIdentifier: 'banner', text: 'hello', [privateKey]: 'secret' }, (details) => {
      alerts.push(details)
      alertStarted()
      return new Promise((resolve) => { finishAlert = resolve })
    })
    let completed = false
    const pending = f.route.POST(f.request).then((response) => { completed = true; return response })
    await started
    assert.equal(completed, false)
    assert.equal(alerts.length, 1)
    assert.match(alerts[0].detail, /serviceIdentifier/)
    assert(!JSON.stringify(alerts[0]).includes(privateKey))
    assert(!JSON.stringify(alerts[0]).includes('secret'))
    assert.equal(f.saves.length, 0)
    finishAlert(false)
    assert.equal((await pending).status, 400)
  })

  await check('Valid sidebar feedback still saves and notifies normally', async () => {
    const alerts = []
    const f = fixture({ service: 'banner', message: '改善案', category: 'improvement' }, async (details) => { alerts.push(details); return true })
    const response = await f.route.POST(f.request)
    assert.equal(response.status, 200)
    assert.equal(f.saves.length, 1)
    assert.equal(f.saves[0].data.serviceId, 'banner')
    assert.equal(f.slackPosts.length, 1)
    assert.equal(alerts.length, 0)
  })
})().catch((error) => { console.error(error); process.exitCode = 1 })
