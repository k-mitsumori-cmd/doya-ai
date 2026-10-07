const assert = require('node:assert/strict')
const { load, check } = require('./load-typescript.cjs')
let supplied
const feedback = load('src/lib/adimage/feedback.ts', { './vision': { visionJson: async () => supplied } })
const input = { pngBase64: 'synthetic', copy: { headline: '見出し', sub: '', cta: '詳しく見る' }, brandName: 'Synthetic', placementName: 'Square' }
const valid = () => ({ scores: { visibility: 1, appeal: 2, cta: 3, fit: 4, brand: 5 }, advice: '改善できます。', directives: [{ target: 'contrast', instruction: '背景を濃くしてください。', reason: '文字が読みにくいため。' }] })
async function rejected(value) { supplied = value; await assert.rejects(() => feedback.evaluateCreative(input), /画像の採点結果を読み取れませんでした/) }
;(async () => {
  await check('AdImage feedback rejects missing and fabricated scores', async () => {
    for (const value of [null, [], {}, { ...valid(), scores: {} }, { ...valid(), scores: [] }]) await rejected(value)
    for (const score of [undefined, null, '', '4', true, false, NaN, Infinity, 0, 6, 2.5, {}, []]) await rejected({ ...valid(), scores: { ...valid().scores, visibility: score } })
  })
  await check('AdImage feedback rejects malformed or unusable improvement directives', async () => {
    for (const directives of [undefined, null, {}, 'text', [null], [{ target: 'other', instruction: '指示', reason: '理由' }], [{ target: 'copy', instruction: {}, reason: '理由' }], [{ target: 'copy', instruction: ' ', reason: '理由' }], [{ target: 'copy', instruction: '指示', reason: {} }], Array(4).fill(valid().directives[0])]) await rejected({ ...valid(), directives })
  })
  await check('AdImage feedback rejects empty, coerced and oversized advice or directives', async () => {
    for (const advice of [undefined, null, {}, 3, ' ', 'a'.repeat(1001)]) await rejected({ ...valid(), advice })
    for (const field of ['instruction', 'reason']) await rejected({ ...valid(), directives: [{ ...valid().directives[0], [field]: 'a'.repeat(501) }] })
  })
  await check('AdImage feedback preserves valid scores and empty directives without inventing concerns', async () => {
    supplied = { ...valid(), directives: [] }; const result = await feedback.evaluateCreative(input)
    assert.equal(result.scores.total, 15); assert.equal(result.scores.visibility, 1); assert.equal(result.directives.length, 0)
    supplied = valid(); supplied.scores.total = 99; supplied.advice = '  総評  '
    const detailed = await feedback.evaluateCreative(input); assert.equal(detailed.scores.total, 15); assert.equal(detailed.advice, '総評'); assert.equal(detailed.directives[0].target, 'contrast')
  })
})().catch(error => { console.error(error); process.exitCode = 1 })
