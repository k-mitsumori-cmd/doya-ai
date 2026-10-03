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

  await check('Shodan never attaches the first unrelated gBizINFO company', async () => {
    const result = await researcher({
      homepage: '<html><title>Example</title></html>',
      basic: { companyName: 'Example' },
      gbiz: { status: 200, totalCount: 1, companies: [
        { name: 'Another Company', corporateNumber: '1111111111111', employeeNumber: '999' },
      ] },
      press: '<html></html>',
    })
    assert.equal(result.companyName, 'Example')
    assert.equal(result.corporateNumber, undefined)
    assert.equal(result.employeeCount, null)
    assert.equal(result.sourceStatus.gbizinfo, 'ok')
  })

  await check('Shodan selects only a unique normalized name or matching company site', async () => {
    const base = { homepage: '<html><title>Example</title></html>', basic: { companyName: 'Example' }, press: '<html></html>' }
    const matched = await researcher({ ...base, gbiz: { status: 200, totalCount: 2, companies: [
      { name: 'Another Company', corporateNumber: '1111111111111', employeeNumber: '999' },
      { name: '株式会社 Example', corporateNumber: '2222222222222', employeeNumber: '24' },
    ] } })
    assert.equal(matched.corporateNumber, '2222222222222')
    assert.equal(matched.employeeCount, 24)

    const ambiguous = await researcher({ ...base, gbiz: { status: 200, totalCount: 2, companies: [
      { name: '株式会社 Example', corporateNumber: '2222222222222', employeeNumber: '24' },
      { name: 'Example合同会社', corporateNumber: '3333333333333', employeeNumber: '240' },
    ] } })
    assert.equal(ambiguous.corporateNumber, undefined)
    assert.equal(ambiguous.employeeCount, null)

    const siteMatched = await researcher({ ...base, gbiz: { status: 200, totalCount: 1, companies: [
      { name: 'Legal Holding Name', companyUrl: 'https://www.example.test/about', corporateNumber: '4444444444444', employeeNumber: '40' },
    ] } })
    assert.equal(siteMatched.corporateNumber, '4444444444444')

    const subdomainOnly = await researcher({ ...base, gbiz: { status: 200, totalCount: 1, companies: [
      { name: 'Different Subsidiary', companyUrl: 'https://sub.example.test', corporateNumber: '5555555555555', employeeNumber: '50' },
    ] } })
    assert.equal(subdomainOnly.corporateNumber, undefined)

    const truncated = await researcher({ ...base, gbiz: { status: 200, totalCount: 21, companies: [
      { name: 'Example株式会社', corporateNumber: '6666666666666', employeeNumber: '60' },
    ] } })
    assert.equal(truncated.corporateNumber, undefined)
  })
})().catch((error) => { console.error(error); process.exitCode = 1 })
