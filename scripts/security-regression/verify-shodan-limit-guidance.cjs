const assert = require('node:assert/strict')
const { check } = require('./load-typescript.cjs')
const { createOrgClient } = require('./org-client-test-loader.cjs')

;(async () => {
  for (const [name, response, expectedUrl, expectedLabel] of [
    ['free', { code: 'LIMIT', error: '無料枠です', upgradeUrl: '/shodan/pricing' }, '/shodan/pricing', '料金プランを確認する'],
    ['paid', { code: 'LIMIT', error: '有料枠です', contactUrl: 'https://doyamarke.surisuta.jp/contact' }, 'https://doyamarke.surisuta.jp/contact', '追加枠について問い合わせる'],
  ]) {
    await check(`Shodan ${name} limit guidance follows the server action`, async () => {
      const client = createOrgClient('shodan', {
        AbortSignal,
        fetch: async () => Response.json(response, { status: 402 }),
      }).client
      await assert.rejects(client.shodanSend('/api/shodan/preparations', 'team', 'POST', { url: 'https://example.test' }), error => {
        assert.equal(error.code, 'LIMIT')
        assert.equal(error.actionUrl, expectedUrl)
        assert.equal(error.actionLabel, expectedLabel)
        return true
      })
    })
  }
})().catch(error => { console.error(error); process.exitCode = 1 })
