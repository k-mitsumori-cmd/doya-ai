const assert = require('node:assert/strict')
const fs = require('node:fs')
const crypto = require('node:crypto')
const { load, check } = require('./load-typescript.cjs')

const secret = 'PRIVATE_REQUEST_TOKEN_AND_PROVIDER_RESPONSE'
const posted = []
const signatures = []
const logs = []
const notifications = load('src/lib/notifications.ts', {
  'node:crypto': crypto,
  './service-operations-daily': {},
  './service-operations-state': {},
  './slack-voice': { voicePayload: (payload) => payload },
  './prisma': {
    prisma: { systemSetting: { findUnique: async () => ({ value: 'https://webhook.invalid' }) } },
    withRetry: async (operation) => operation(),
  },
  './gcp-usage': {},
  './attribution': {},
  './alert': {
    recordErrorAndCheckBurst: () => ({ count: 1, burst: false }),
    shouldSend: (signature) => { signatures.push(signature); return true },
    notifyAlert: async () => {},
    burstThreshold: () => 5,
    buildAiRepairPrompt: (options) => JSON.stringify(options),
  },
}, {
  fetch: async (_url, options) => { posted.push(JSON.parse(options.body)); return { ok: true } },
  console: { error: (...parts) => logs.push(parts.join(' ')), log() {}, warn() {} },
})

;(async () => {
  await check('Error alert strips request, URL, user and stack details', async () => {
    await notifications.sendErrorNotification({
      errorMessage: `Database failure: ${secret}`,
      errorStack: `Error: ${secret}\n at route (${secret})`,
      pathname: `/api/banner/generate/${secret}`,
      requestUrl: `https://doya.test/api/banner/generate?token=${secret}`,
      requestBody: JSON.stringify({ apiKey: secret }),
      userEmail: `${secret}@example.invalid`,
      userId: secret,
      requestMethod: 'POST',
      httpStatus: 500,
      timestamp: secret,
    })
    assert.equal(posted.length, 1)
    const body = JSON.stringify(posted[0])
    assert(!body.includes(secret))
    assert(body.includes('/api/banner'))
    assert(body.includes('500'))
    assert(body.includes('POST'))
    assert(!body.includes('apiKey'))
    assert(!body.includes('example.invalid'))
    assert.equal(signatures.length, 1)
    assert(!signatures[0].includes(secret))
  })

  await check('Distinct incidents retain distinct dedupe signatures without raw details', async () => {
    await notifications.sendErrorNotification({ errorMessage: `Another ${secret}`, pathname: '/api/banner/generate', timestamp: secret })
    assert.equal(posted.length, 2)
    assert.notEqual(signatures[0], signatures[1])
    assert(!JSON.stringify(posted[1]).includes(secret))
  })

  await check('Notifier failures do not log webhook or provider errors', async () => {
    const failing = load('src/lib/notifications.ts', {
      'node:crypto': crypto,
      './service-operations-daily': {}, './service-operations-state': {},
      './slack-voice': { voicePayload: (payload) => payload },
      './prisma': { prisma: { systemSetting: { findUnique: async () => ({ value: 'https://webhook.invalid' }) } }, withRetry: async (operation) => operation() },
      './gcp-usage': {}, './attribution': {},
      './alert': { recordErrorAndCheckBurst: () => ({ count: 1, burst: false }), shouldSend: () => true, buildAiRepairPrompt: () => '', notifyAlert: async () => {}, burstThreshold: () => 5 },
    }, {
      fetch: async () => { throw new Error(secret) },
      console: { error: (...parts) => logs.push(parts.join(' ')), log() {}, warn() {} },
    })
    await failing.sendErrorNotification({ errorMessage: secret, pathname: '/api/banner/generate', timestamp: secret })
    assert(!logs.join(' ').includes(secret))
  })

  await check('Shared error handler never reads or forwards request bodies', async () => {
    const sent = []
    const handler = load('src/lib/errorHandler.ts', {
      './notifications': { sendErrorNotification: async (data) => { sent.push(data) } },
    })
    const request = new Request(`https://doya.test/api/banner/generate?token=${secret}`, {
      method: 'POST', body: JSON.stringify({ secret }),
    })
    await handler.notifyApiError(new Error(secret), request, 500, { secret })
    assert.equal(sent.length, 1)
    assert(!JSON.stringify(sent[0]).includes(secret))
    assert.equal(sent[0].requestBody, undefined)
  })

  await check('Slack delivery errors never log webhook response bodies', async () => {
    const alert = fs.readFileSync('src/lib/alert.ts', 'utf8')
    const notice = fs.readFileSync('src/lib/notifications.ts', 'utf8')
    assert(!alert.includes("res.text().catch(() => '')"))
    assert(!/console\.error\([^\n]*,\s*(?:e|err|error)\b/.test(alert))
    assert(!/console\.error\([^\n]*,\s*(?:e|err|error)\b/.test(notice))
  })
})().catch((error) => { console.error(error); process.exitCode = 1 })
