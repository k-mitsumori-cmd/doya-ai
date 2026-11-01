const assert = require('node:assert/strict')
const { load, check } = require('./load-typescript.cjs')
let supplied
const gemini = { GEMINI_TEXT_MODEL_DEFAULT: 'synthetic', geminiGenerateJson: async () => supplied }
const brand = load('src/lib/adimage/brand.ts', { '@seo/lib/gemini': gemini, '@/lib/net/safe-fetch': { safeFetchText: () => { throw Error('Unexpected source fetch') } } })
const copy = load('src/lib/adimage/copy.ts', { '@seo/lib/gemini': gemini, './types': load('src/lib/adimage/types.ts') })
const profile = { name: 'Synthetic', valueProps: ['Useful'], colors: ['#0066ff'] }
const draft = () => ({ label: 'Synthetic', appealAxis: 'benefit', tone: 'plain', copy: { headline: '見出し', sub: '', cta: '確認' } })
;(async () => {
  await check('Provider brand objects and malformed value arrays never become user-visible strings', async () => {
    for (const raw of [null, [], { ...profile, name: {} }, { ...profile, description: [] }, { ...profile, valueProps: 'wrong' }, { ...profile, valueProps: [{}] }]) {
      supplied = raw; await assert.rejects(brand.analyzeBrand('https://synthetic.test', 'Synthetic service description. '.repeat(5)), /Invalid brand analysis output/)
    }
    supplied = profile; const valid = await brand.analyzeBrand('https://synthetic.test', 'Synthetic service description. '.repeat(5)); assert.equal(valid.name, 'Synthetic'); assert.equal(valid.valueProps[0], 'Useful')
  })
  await check('Provider copy objects and false appeal axes cannot be silently rewritten as valid copy', async () => {
    for (const patch of [{ copy: { headline: {}, cta: '確認' } }, { copy: { headline: '確認', cta: 100 } }, { label: {} }, { appealAxis: '__proto__' }, { tone: [] }]) {
      supplied = { concepts: [{ ...draft(), ...patch }] }; await assert.rejects(copy.generateConcepts({ brand: profile }), /Invalid concept analysis output/)
    }
    supplied = { concepts: [draft()] }; assert.equal((await copy.generateConcepts({ brand: profile }))[0].copy.headline, '見出し')
  })
})().catch(error => { console.error(error); process.exitCode = 1 })
