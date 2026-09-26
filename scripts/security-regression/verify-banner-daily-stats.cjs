const assert = require('node:assert/strict')
const { load, check } = require('./load-typescript.cjs')
const { bannerDailyStats } = load('src/lib/banner/daily-stats.ts')

;(async () => {
  await check('weekly banner chart uses the latest seven Japan calendar days, including zero days', () => {
    const history = [
      { createdAt: '2026-09-25T16:00:00.000Z', bannerCount: 3 }, // Sep 26 JST
      { createdAt: '2026-09-19T15:00:00.000Z', bannerCount: 2 }, // Sep 20 JST
      { createdAt: '2026-09-21T02:00:00.000Z', bannerCount: 1 }, // Sep 21 JST
      { createdAt: '2026-09-18T15:00:00.000Z', bannerCount: 99 }, // older than seven days
      { createdAt: '2026-09-25T14:59:59.000Z', bannerCount: 4 }, // Sep 25 JST
      { createdAt: 'invalid', bannerCount: 20 },
    ]
    const actual = bannerDailyStats(history, new Date('2026-09-26T02:00:00.000Z'))
    assert.equal(JSON.stringify(actual), JSON.stringify([
      { date: '9/20', count: 2 }, { date: '9/21', count: 1 }, { date: '9/22', count: 0 },
      { date: '9/23', count: 0 }, { date: '9/24', count: 0 }, { date: '9/25', count: 4 }, { date: '9/26', count: 3 },
    ]))
  })
})().catch(error => { console.error(error); process.exitCode = 1 })
