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
    clearSendCooldown: () => {},
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
    assert(body.includes('/api/banner/generate'))
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
      './alert': { recordErrorAndCheckBurst: () => ({ count: 1, burst: false }), shouldSend: () => true, clearSendCooldown: () => {}, buildAiRepairPrompt: () => '', notifyAlert: async () => {}, burstThreshold: () => 5, getAlertWebhook: async () => 'https://webhook.invalid' },
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
    const bursts = []
    const makeInstance = () => load('src/lib/notifications.ts', {
      'node:crypto': crypto,
      './service-operations-daily': {}, './service-operations-state': {},
      './slack-voice': { voicePayload: (payload) => payload },
      './prisma': { prisma: { systemSetting: { findUnique: async () => ({ value: 'https://webhook.invalid' }) } }, withRetry: async (operation) => operation() },
      './gcp-usage': {}, './attribution': {},
      './alert': { recordErrorAndCheckBurst: () => ({ count: 5, burst: true }), shouldSend: () => true, clearSendCooldown: () => {}, buildAiRepairPrompt: () => '', notifyAlert: async (alert) => { bursts.push(alert) }, burstThreshold: () => 5, getAlertWebhook: async () => 'https://webhook.invalid' },
      './runtime-alert-limit': {
        claimRuntimeAlert: async (hash, channel) => {
          assert(['api-error', 'api-burst'].includes(channel))
          assert.match(hash, /^[a-f0-9]{24}$/)
          const key = `${channel}:v1:${hash}`
          if (shared.has(key)) return { state: 'limited' }
          shared.add(key)
          return { state: 'allowed', key, value: 'future' }
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
    assert.equal(bursts.length, 1)
    assert.equal(shared.size, 2)
    assert.equal(sends[0].signal instanceof AbortSignal, true)
    assert(!JSON.stringify(sends[0].body).includes(secret))
    for (const pathname of ['/api/banner/refine', '/api/cron/daily-summary', '/api/cron/monthly-summary']) {
      await makeInstance().sendErrorNotification({ errorMessage: 'Another failure', pathname, requestMethod: 'POST', httpStatus: 500, timestamp: secret })
    }
    assert.equal(sends.length, 4, 'separate static routes must not suppress one another')
    assert.equal(shared.size, 5)
    await makeInstance().sendErrorNotification({ errorMessage: secret, pathname: `/api/banner/generate/${secret}`, requestMethod: 'POST', httpStatus: 500, timestamp: secret })
    assert.equal(sends.length, 4, 'a dynamic suffix must not create a new alert source')
  })

  await check('HTTP delivery failure releases the shared claim', async () => {
    let releases = 0
    const failed = load('src/lib/notifications.ts', {
      'node:crypto': crypto,
      './service-operations-daily': {}, './service-operations-state': {},
      './slack-voice': { voicePayload: (payload) => payload },
      './prisma': { prisma: { systemSetting: { findUnique: async () => ({ value: 'https://webhook.invalid' }) } }, withRetry: async (operation) => operation() },
      './gcp-usage': {}, './attribution': {},
      './alert': { recordErrorAndCheckBurst: () => ({ count: 1, burst: false }), shouldSend: () => true, clearSendCooldown: () => {}, buildAiRepairPrompt: () => '', notifyAlert: async () => {}, burstThreshold: () => 5, getAlertWebhook: async () => 'https://webhook.invalid' },
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

  await check('A failed production delivery can retry on the same instance', async () => {
    let attempts = 0
    let releases = 0
    let localChecks = 0
    const retryable = load('src/lib/notifications.ts', {
      'node:crypto': crypto,
      './service-operations-daily': {}, './service-operations-state': {},
      './slack-voice': { voicePayload: (payload) => payload },
      './prisma': { prisma: {}, withRetry: async (operation) => operation() },
      './gcp-usage': {}, './attribution': {},
      './alert': {
        recordErrorAndCheckBurst: () => ({ count: 1, burst: false }),
        shouldSend: () => { localChecks++; return false },
        clearSendCooldown: () => {},
        buildAiRepairPrompt: () => '', notifyAlert: async () => {}, burstThreshold: () => 5,
        getAlertWebhook: async () => 'https://webhook.invalid',
      },
      './runtime-alert-limit': {
        claimRuntimeAlert: async () => ({ state: 'allowed', key: 'api-error:v1:test', value: 'future' }),
        releaseRuntimeAlertClaim: async () => { releases++ },
      },
    }, {
      AbortSignal,
      process: { env: { VERCEL_ENV: 'production' } },
      fetch: async () => ({ ok: ++attempts > 1, status: 503 }),
      console: { error() {}, log() {}, warn() {} },
    })
    const incident = { errorMessage: secret, pathname: '/api/banner/generate', timestamp: secret }
    await retryable.sendErrorNotification(incident)
    await retryable.sendErrorNotification(incident)
    assert.equal(attempts, 2)
    assert.equal(releases, 1)
    assert.equal(localChecks, 0)
  })

  await check('Fallback cooldown is cleared after failed delivery', async () => {
    const reserved = new Set()
    let attempts = 0
    let clears = 0
    const fallback = load('src/lib/notifications.ts', {
      'node:crypto': crypto,
      './service-operations-daily': {}, './service-operations-state': {},
      './slack-voice': { voicePayload: (payload) => payload },
      './prisma': { prisma: {}, withRetry: async (operation) => operation() },
      './gcp-usage': {}, './attribution': {},
      './alert': {
        recordErrorAndCheckBurst: () => ({ count: 1, burst: false }),
        shouldSend: (key) => { if (reserved.has(key)) return false; reserved.add(key); return true },
        clearSendCooldown: (key) => { clears++; reserved.delete(key) },
        buildAiRepairPrompt: () => '', notifyAlert: async () => {}, burstThreshold: () => 5,
        getAlertWebhook: async () => 'https://webhook.invalid',
      },
      './runtime-alert-limit': { claimRuntimeAlert: async () => ({ state: 'unavailable' }), releaseRuntimeAlertClaim: async () => {} },
    }, {
      AbortSignal,
      fetch: async () => ({ ok: ++attempts > 1, status: 503 }),
      console: { error() {}, log() {}, warn() {} },
    })
    const incident = { errorMessage: secret, pathname: '/api/banner/generate', timestamp: secret }
    await fallback.sendErrorNotification(incident)
    await fallback.sendErrorNotification(incident)
    await fallback.sendErrorNotification(incident)
    assert.equal(attempts, 2)
    assert.equal(clears, 1)
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
