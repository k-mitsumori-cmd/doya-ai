const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')

const { streamDoyalistJsonArray } = load('src/lib/doyalist/stream-json.ts', {}, {
  TextEncoder, ReadableStream, Uint8Array,
})

;(async () => {
  const rows = Array.from({ length: 2000 }, (_, id) => ({ id, description: 'x'.repeat(2500) }))
  const response = streamDoyalistJsonArray({ success: true, generated: rows.length }, 'companies', rows)
  assert.equal(response.status, 200)
  assert.match(response.headers.get('content-type'), /application\/json/)
  assert.match(response.headers.get('cache-control'), /no-store/)
  const reader = response.body.getReader()
  const chunks = []
  let bytes = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    bytes += value.byteLength
    chunks.push(Buffer.from(value))
  }
  assert(bytes > 4.5 * 1024 * 1024, 'test must exceed the regular Function response limit')
  assert(chunks.length > 10, 'large JSON must be delivered in many chunks')
  const parsed = JSON.parse(Buffer.concat(chunks, bytes).toString('utf8'))
  assert.equal(parsed.generated, 2000)
  assert.equal(parsed.companies.length, 2000)
  assert.equal(parsed.companies[1999].id, 1999)

  const empty = await streamDoyalistJsonArray({ success: true }, 'companies', []).json()
  assert.deepEqual(empty, { success: true, companies: [] })
  console.log('PASS Doyalist large and empty list responses stream valid JSON in bounded chunks')
})().catch((error) => { console.error(error); process.exitCode = 1 })
