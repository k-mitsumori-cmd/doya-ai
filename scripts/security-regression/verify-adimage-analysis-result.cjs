const assert = require('node:assert/strict')
const { load, check } = require('./load-typescript.cjs')
const types = load('src/lib/adimage/types.ts')
const { validAdImageAnalysisOutput: valid } = load('src/lib/adimage/analysis-result.ts', { './types': types }, { TextEncoder })
const result = () => ({ brand: { name: 'Synthetic', valueProps: ['Useful'], colors: ['#0066ff'], logoUrl: 'https://synthetic.test/logo.png' }, concepts: [{ label: 'Synthetic', appealAxis: 'benefit', tone: 'plain', copy: { headline: '見出し', sub: '', cta: '確認する' }, warnings: [] }] })
;(async () => {
  await check('Analysis output retains valid bounded brand, editable copy and warnings', async () => {
    const d = result(); d.concepts[0].warnings = ['根拠を確認してください']; assert(valid(d))
    d.concepts = Array.from({ length: 4 }, () => ({ ...d.concepts[0] })); assert(valid(d))
  })
  await check('Analysis recovery rejects malformed or fabricated brand fields and credential URLs', async () => {
    for (const patch of [{ name: {} }, { valueProps: 'string' }, { colors: ['red'] }, { colors: [] }, { description: {} }, { logoUrl: 'https://user:secret@example.test' }, { userId: 'foreign' }, { manualText: 'private source' }]) {
      const d = result(); Object.assign(d.brand, patch); assert.equal(valid(d), false)
    }
    for (const v of [null, [], {}, { ...result(), receipt: 'private' }]) assert.equal(valid(v), false)
  })
  await check('Analysis recovery rejects malformed copy, unknown axes, oversized drafts and private fields', async () => {
    for (const patch of [{ appealAxis: '__proto__' }, { tone: {} }, { label: 'x'.repeat(121) }, { copy: { headline: {}, sub: '', cta: '確認' } }, { copy: { headline: 'x'.repeat(14), sub: '', cta: '確認' } }, { copy: { headline: '確認', sub: '', cta: '' } }, { warnings: [{}] }, { prompt: 'private source' }]) {
      const d = result(); Object.assign(d.concepts[0], patch); assert.equal(valid(d), false)
    }
    const d = result(); d.concepts = []; assert.equal(valid(d), false); d.concepts = Array.from({ length: 5 }, () => result().concepts[0]); assert.equal(valid(d), false)
  })
  await check('Analysis saved output is bounded by actual UTF8 bytes across valid individual fields', async () => {
    const d = result(); d.brand.valueProps = Array.from({ length: 8 }, () => 'あ'.repeat(500))
    d.concepts[0].warnings = Array.from({ length: 10 }, () => 'あ'.repeat(500)); assert(valid(d))
    d.concepts = Array.from({ length: 4 }, () => d.concepts[0]); assert.equal(valid(d), false)
  })
})().catch(error => { console.error(error); process.exitCode = 1 })
