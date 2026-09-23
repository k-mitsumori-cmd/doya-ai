const assert = require('node:assert/strict')
require('tsx/cjs')

const { buildServiceSubMetadata, generateSoftwareApplicationSchema } = require('../../src/lib/seo.ts')

for (const [id, unit, freeLimit, proLimit] of [
  ['banner', '枚', 15, 150],
  ['seo', '回', 3, 30],
]) {
  const metadata = buildServiceSubMetadata(id, 'pricing', { path: `/${id}/pricing` })
  const description = metadata.description
  assert.equal(typeof description, 'string')
  assert(description.includes(`月${freeLimit}${unit}`))
  assert(description.includes(`月${proLimit}${unit}`))
  assert(description.includes('月額¥9,980'))
  assert(!description.includes('ゲスト') && !description.includes('1日'))
  assert.equal(metadata.openGraph.description, description)
  assert.equal(metadata.twitter.description, description)
  assert.equal(metadata.alternates.canonical, `/${id}/pricing`)
  const schema = generateSoftwareApplicationSchema(id)
  assert(schema.offers.description.includes(`月${freeLimit}${unit}`))
  assert(!schema.offers.description.includes('ゲスト'))
}

const opening = buildServiceSubMetadata('opening', 'pricing', { path: '/opening/pricing' })
assert(opening.description.includes('月額¥9,980'))
assert(!opening.description.includes('¥2,980'))
const guide = buildServiceSubMetadata('banner', 'guide', { path: '/banner/guide', description: 'ガイド固有の説明文' })
assert.equal(guide.description, 'ガイド固有の説明文')
assert.equal(guide.openGraph.description, 'ガイド固有の説明文')
assert.equal(guide.twitter.description, 'ガイド固有の説明文')
console.log('PASS pricing and guide metadata use page-specific descriptions in HTML, OG, and Twitter')
