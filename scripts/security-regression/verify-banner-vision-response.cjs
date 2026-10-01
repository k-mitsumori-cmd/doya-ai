// Offline regression for bounded Vision results in the active banner URL flow.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { load, check } = require('./load-typescript.cjs')

const reader = load('src/lib/banner/vision-response.ts').readBannerVisionJson
const route = fs.readFileSync(path.join(__dirname, '../../src/app/api/banner/from-url/route.ts'), 'utf8')

;(async () => {
  await check('Banner Vision parses valid response and retains a body-wide timeout', async () => {
    assert.equal(JSON.stringify(await reader(Response.json({ responses: [{ faceAnnotations: [] }] }))), '{"responses":[{"faceAnnotations":[]}]}')
    assert.equal((route.match(/readBannerVisionJson\(res\)/g) || []).length, 2)
    assert.equal((route.match(/signal: AbortSignal\.timeout\(10_000\)/g) || []).length, 2)
  })
  await check('Banner Vision rejects declared and streamed oversized responses', async () => {
    await assert.rejects(reader(new Response('x', { headers: { 'content-length': '1048577' } })), /too large/)
    await assert.rejects(reader(new Response(Buffer.alloc(1048577))), /too large/)
  })
  await check('Banner Vision does not read or log provider error bodies', async () => {
    assert.equal(route.includes('res.text().catch'), false)
    assert.equal(route.includes('Vision API error: ${res.status} ${t.slice'), false)
  })
})().catch(error => { console.error(error); process.exitCode = 1 })
