const assert = require('node:assert/strict')
const { load, check } = require('./load-typescript.cjs')

let sent
const usage = load('src/lib/service-usage.ts', {
  '@vercel/functions': { waitUntil: () => {} },
  './prisma': {
    prisma: {
      user: { findUnique: async () => ({ name: '利用者', email: null, plan: 'FREE', createdAt: new Date(), signupService: null, signupSource: null }) },
      generation: { groupBy: async () => [] },
    },
    withRetry: (fn) => fn(),
  },
  './attribution': { serviceLabelOf: (id) => id },
  './notifications': { postToSlackBlocks: async (text, blocks) => { sent = JSON.stringify({ text, blocks }) } },
  './alert': { shouldSend: () => true },
  './unified-plan': { isPaidPlan: () => false },
})

;(async () => {
  await check('first-use Slack notice contains the action without user input summaries', async () => {
    await usage.notifyFirstServiceUse({
      userId: 'user', serviceId: 'mensetsu', action: '面接URLを発行',
      summary: '第三者の個人情報を含む入力内容',
    })
    assert.match(sent, /面接URLを発行/)
    assert.doesNotMatch(sent, /第三者の個人情報/)
  })
})().catch((error) => { console.error(error); process.exitCode = 1 })
