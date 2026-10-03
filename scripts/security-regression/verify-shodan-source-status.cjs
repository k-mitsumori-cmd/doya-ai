const assert = require('node:assert/strict')
const { load, check } = require('./load-typescript.cjs')

function researcher({ homepage, basic, gbiz, press }) {
  return load('src/lib/shodan/research.ts', {
    '@/lib/net/safe-fetch': {
      safeFetchText: async (url) => url.includes('prtimes.jp') ? press : homepage,
      htmlToText: (html) => html.replace(/<[^>]+>/g, ' '),
    },
    '@/lib/doyalist/collect/web-scraper': { scrapeCompanyWebsite: async () => basic },
    '@/lib/doyalist/collect/gbizinfo': { searchGbizInfo: async () => gbiz },
  }).researchCompany('https://example.test')
}

const facts = load('src/lib/shodan/ai.ts', {
  '@seo/lib/gemini': {},
}).researchToFacts

;(async () => {
  await check('failed Shodan providers remain unknown in research and AI facts', async () => {
    const result = await researcher({
      homepage: null,
      basic: { companyName: 'Example' },
      gbiz: { companies: [], status: 0 },
      press: null,
    })
    assert.deepEqual(JSON.parse(JSON.stringify(result.sourceStatus)), {
      homepage: 'failed', gbizinfo: 'failed', prtimes: 'failed',
    })
    assert.match(result.marketing.summary, /未確認/)
    assert.equal(result.pressReleases.length, 0)
    const text = facts(result)
    assert.match(text, /実従業員数: 未確認/)
    assert.match(text, /PR TIMESは未確認または取得失敗/)
    assert.doesNotMatch(text, /公的データ・サイトともに明示なし|PR TIMESでヒットなし|オウンドメディア\/ブログ等: 目立つものは確認できず/)
  })

  await check('successful empty Shodan responses are distinguished from provider failure', async () => {
    const result = await researcher({
      homepage: '<html><title>Example</title><body>会社概要</body></html>',
      basic: { companyName: 'Example' },
      gbiz: { companies: [], status: 404 },
      press: '<html><body>検索結果はありません</body></html>',
    })
    assert.deepEqual(JSON.parse(JSON.stringify(result.sourceStatus)), {
      homepage: 'ok', gbizinfo: 'ok', prtimes: 'ok',
    })
    assert.match(facts(result), /取得した範囲ではプレスリリースのヒットなし/)
  })

  await check('missing company name skips dependent providers rather than reporting no hits', async () => {
    const result = await researcher({ homepage: null, basic: null, gbiz: null, press: null })
    assert.deepEqual(JSON.parse(JSON.stringify(result.sourceStatus)), {
      homepage: 'failed', gbizinfo: 'skipped', prtimes: 'skipped',
    })
  })
})().catch((error) => { console.error(error); process.exitCode = 1 })
