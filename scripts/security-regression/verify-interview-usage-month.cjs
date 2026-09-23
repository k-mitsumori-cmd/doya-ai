const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')

const { interviewJstMonthStartUtc } = load('src/lib/interview/month.ts')
assert.equal(interviewJstMonthStartUtc(new Date('2026-08-31T14:59:59.000Z')).toISOString(), '2026-07-31T15:00:00.000Z')
assert.equal(interviewJstMonthStartUtc(new Date('2026-08-31T15:00:00.000Z')).toISOString(), '2026-08-31T15:00:00.000Z')
assert.equal(interviewJstMonthStartUtc(new Date('2026-09-30T14:59:59.000Z')).toISOString(), '2026-08-31T15:00:00.000Z')
assert.equal(interviewJstMonthStartUtc(new Date('2026-09-30T15:00:00.000Z')).toISOString(), '2026-09-30T15:00:00.000Z')

let aggregateCalls = 0
const route = load('src/app/api/interview/usage/route.ts', {
  'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } },
  'next-auth': { getServerSession: async () => ({ user: { id: 'owner', plan: 'PRO' } }) },
  '@/lib/auth': { authOptions: {} },
  '@/lib/prisma': { __esModule: true, default: { interviewMaterial: { aggregate: async ({ where }) => {
    aggregateCalls++
    assert.equal(where.project.userId, 'owner')
    assert.equal(where.status, 'COMPLETED')
    assert.equal(where.createdAt, undefined)
    assert.equal(where.updatedAt.gte.toISOString(), interviewJstMonthStartUtc().toISOString())
    return { _sum: { duration: 61 } }
  } } } },
  '@/lib/pricing': { getInterviewLimitsByPlan: () => ({ transcriptionMinutes: 150 }) },
  '@/lib/interview/month': { interviewJstMonthStartUtc },
})

route.GET().then(response => {
  assert.equal(response.status, 200)
  assert.equal(response.body.usedMinutes, 2)
  assert.equal(response.body.limitMinutes, 150)
  assert.equal(aggregateCalls, 1)
  console.log('PASS interview monthly usage uses JST boundary and transcription completion update')
}).catch(error => { console.error(error); process.exitCode = 1 })
