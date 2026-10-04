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
    getAlertWebhook: async () => 'https://webhook.invalid',
  },
  './runtime-alert-limit': { claimRuntimeAlert: async () => ({ state: 'allowed' }), releaseRuntimeAlertClaim: async () => {} },
}, {
  fetch: async (_url, options) => { posted.push(JSON.parse(options.body)); return { ok: true } },
  AbortSignal,
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
      './alert': { recordErrorAndCheckBurst: () => ({ count: 1, burst: false }), shouldSend: () => true, buildAiRepairPrompt: () => '', notifyAlert: async () => {}, burstThreshold: () => 5, getAlertWebhook: async () => 'https://webhook.invalid' },
      './runtime-alert-limit': { claimRuntimeAlert: async () => ({ state: 'allowed' }), releaseRuntimeAlertClaim: async () => {} },
    }, {
      fetch: async () => { throw new Error(secret) },
      AbortSignal,
      console: { error: (...parts) => logs.push(parts.join(' ')), log() {}, warn() {} },
    })
    await failing.sendErrorNotification({ errorMessage: secret, pathname: '/api/banner/generate', timestamp: secret })
    assert(!logs.join(' ').includes(secret))
  })

  await check('Production API errors from isolated instances share one alert', async () => {
    const shared = new Set()
    const sends = []
    const makeInstance = () => load('src/lib/notifications.ts', {
      'node:crypto': crypto,
      './service-operations-daily': {}, './service-operations-state': {},
      './slack-voice': { voicePayload: (payload) => payload },
      './prisma': { prisma: { systemSetting: { findUnique: async () => ({ value: 'https://webhook.invalid' }) } }, withRetry: async (operation) => operation() },
      './gcp-usage': {}, './attribution': {},
      './alert': { recordErrorAndCheckBurst: () => ({ count: 1, burst: false }), shouldSend: () => true, buildAiRepairPrompt: () => '', notifyAlert: async () => {}, burstThreshold: () => 5, getAlertWebhook: async () => 'https://webhook.invalid' },
      './runtime-alert-limit': {
        claimRuntimeAlert: async (hash, channel) => {
          assert.equal(channel, 'api-error')
          assert.match(hash, /^[a-f0-9]{24}$/)
          if (shared.has(hash)) return { state: 'limited' }
          shared.add(hash)
          return { state: 'allowed', key: `api-error:v1:${hash}`, value: 'future' }
        },
        releaseRuntimeAlertClaim: async () => {},
      },
    }, {
      AbortSignal,
      process: { env: { VERCEL_ENV: 'production' } },
      fetch: async (_url, options) => { sends.push(options); return { ok: true } },
    })
    await Promise.all(Array.from({ length: 12 }, () => makeInstance().sendErrorNotification({
      errorMessage: 'Same underlying failure', pathname: '/api/banner/generate', requestMethod: 'POST', httpStatus: 500, timestamp: secret,
    })))
    assert.equal(sends.length, 1)
    assert.equal(shared.size, 1)
    assert.equal(sends[0].signal instanceof AbortSignal, true)
    assert(!JSON.stringify(sends[0].body).includes(secret))
  })

  await check('HTTP delivery failure releases the shared claim', async () => {
    let releases = 0
    const failed = load('src/lib/notifications.ts', {
      'node:crypto': crypto,
      './service-operations-daily': {}, './service-operations-state': {},
      './slack-voice': { voicePayload: (payload) => payload },
      './prisma': { prisma: { systemSetting: { findUnique: async () => ({ value: 'https://webhook.invalid' }) } }, withRetry: async (operation) => operation() },
      './gcp-usage': {}, './attribution': {},
      './alert': { recordErrorAndCheckBurst: () => ({ count: 1, burst: false }), shouldSend: () => true, buildAiRepairPrompt: () => '', notifyAlert: async () => {}, burstThreshold: () => 5, getAlertWebhook: async () => 'https://webhook.invalid' },
      './runtime-alert-limit': {
        claimRuntimeAlert: async () => ({ state: 'allowed', key: 'api-error:v1:test', value: 'future' }),
        releaseRuntimeAlertClaim: async () => { releases++ },
      },
    }, {
      AbortSignal,
      process: { env: { VERCEL_ENV: 'production' } },
      fetch: async () => ({ ok: false, status: 503 }),
    })
    await failed.sendErrorNotification({ errorMessage: secret, pathname: '/api/banner/generate', timestamp: secret })
    assert.equal(releases, 1)
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
