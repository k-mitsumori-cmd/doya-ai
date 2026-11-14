const assert = require('node:assert/strict')
const { test } = require('node:test')
const { NextResponse } = require('next/server')
const { load } = require('./load-typescript.cjs')

const cases = [
  { name: 'anonymous', status: 401 },
  { name: 'anonymous with transcript', status: 401, transcript: true },
  { name: 'missing session', status: 404 },
  { name: 'not evaluated', status: 400 },
  { name: 'renderer error', status: 502 },
  { name: 'PDF attachment', status: 200 },
  { name: 'PDF attachment with transcript', status: 200, transcript: true },
]
const pdf = Buffer.from('%PDF-synthetic-cache-test')
const session = {
  id: 'fixture-session', organization: { name: 'Fixture' }, template: { criteria: [] },
  scores: [], turns: [{ speaker: 'candidate', text: 'Synthetic utterance' }],
  candidateName: '検証用応募者', evaluatedAt: new Date(),
}

for (const scenario of cases) {
  test('Mensetsu PDF private cache: ' + scenario.name, async () => {
    let reads = 0
    let renders = 0
    const { GET } = load('src/app/api/mensetsu/sessions/[id]/pdf/route.ts', {
      'next/server': { NextResponse },
      '@/lib/prisma': { prisma: { mensetsuSession: { async findFirst(query) {
        reads++
        assert.equal(query.where.id, session.id)
        assert.equal(query.where.organizationId, 'fixture-org')
        if (scenario.status === 404) return null
        return { ...session, evaluatedAt: scenario.status === 400 ? null : session.evaluatedAt }
      } } } },
      '@/lib/mensetsu/access': {
        orgSlugFrom: () => undefined,
        getMensetsuContext: async () => scenario.status === 401 ? null : { organizationId: 'fixture-org' },
      },
      '@/lib/mensetsu/evaluate': { weightedAverage: () => null },
      '@/lib/mensetsu/types': { LEVEL_LABELS: { mid: '中途' } },
      '@/lib/mensetsu/pdf': { async generateReportPdf(input) {
        renders++
        assert.equal(input.includeTranscript, Boolean(scenario.transcript))
        if (scenario.status === 502) throw Error('Synthetic render failed')
        return pdf
      } },
    })
    const suffix = scenario.transcript ? '?transcript=1' : ''
    const response = await GET(new Request('https://fixture.invalid/pdf' + suffix), {
      params: Promise.resolve({ id: session.id }),
    })
    assert.equal(response.status, scenario.status)
    assert.equal(response.headers.get('cache-control'), 'private, no-store')
    assert.match(response.headers.get('vary'), /\bCookie\b/i)
    assert.equal(reads, scenario.status === 401 ? 0 : 1)
    assert.equal(renders, [200, 502].includes(scenario.status) ? 1 : 0)
    if (scenario.status === 200) {
      assert.equal(response.headers.get('content-type'), 'application/pdf')
      assert.match(response.headers.get('content-disposition'), /^attachment;.*filename\*=UTF-8''/)
      assert.deepEqual(Buffer.from(await response.arrayBuffer()), pdf)
    } else {
      assert.equal(typeof (await response.json()).error, 'string')
    }
  })
}
