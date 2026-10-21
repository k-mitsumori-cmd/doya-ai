// Actual report, recording and HR handoff routes with synthetic session/Prisma/provider.
// No real storage, PDF engine, HR employee, network or notification is used.
const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')
const mensetsu = { A: { id: 'org-A', slug: 'A', name: 'Mensetsu A' }, B: { id: 'org-B', slug: 'B', name: 'Mensetsu B' } }
let pdfCalls = [], signedCalls = [], writes = [], auditCalls = []
const db = {
  mensetsuMember: { findFirst: async ({ where }) => {
    assert.equal(where.userId, 'actor-1')
    const org = mensetsu[where.organization?.slug || 'A']
    return org ? { userId: 'actor-1', organizationId: org.id, role: 'manager', status: 'ACTIVE', organization: org } : null
  } },
  mensetsuSession: { findFirst: async ({ where }) => {
    const org = Object.values(mensetsu).find(value => value.id === where.organizationId)
    if (!org || where.id !== `session-${org.slug}`) return null
    return { id: where.id, organizationId: org.id, organization: org, candidateName: `Candidate ${org.slug}`,
      candidateEmail: 'synthetic@example.invalid', hrEmployeeId: null, recordingPath: `recording-${org.slug}`,
      evaluatedAt: new Date('2026-10-01T00:00:00Z'), endedAt: new Date('2026-10-01T00:00:00Z'), verdict: null,
      overallComment: null, recruiterReport: null, template: { jobTitle: 'Synthetic', level: 'mid', durationMin: 10, criteria: [] },
      scores: [], turns: [] }
  } },
  hrOrganizationMember: { findMany: async ({ where }) => {
    assert.equal(where.userId, 'actor-1')
    return [{ role: 'ADMIN', organization: { id: 'hr-X', name: 'HR X' } }]
  } },
}
const types = load('src/lib/mensetsu/types.ts')
const access = load('src/lib/mensetsu/access.ts', {
  'next-auth': { getServerSession: async () => ({ user: { id: 'actor-1' } }) },
  '@/lib/auth': { authOptions: {} }, '@/lib/prisma': { prisma: db }, '@/lib/account-lifecycle/store': {}, './types': types,
})
const common = { 'next/server': { NextRequest: Request, NextResponse: Response }, '@/lib/prisma': { prisma: db }, '@/lib/mensetsu/access': access }
const recording = load('src/app/api/mensetsu/sessions/[id]/recording/route.ts', {
  ...common, '@/lib/mensetsu/storage': { signedRecordingUrl: async path => { signedCalls.push(path); return `https://recording.invalid/${path}` } },
})
const pdf = load('src/app/api/mensetsu/sessions/[id]/pdf/route.ts', {
  ...common, '@/lib/mensetsu/evaluate': { weightedAverage: () => null },
  '@/lib/mensetsu/pdf': { generateReportPdf: async input => { pdfCalls.push(input); return new TextEncoder().encode('synthetic PDF') } },
  '@/lib/mensetsu/types': types,
}, { TextEncoder })
const handoff = load('src/app/api/mensetsu/sessions/[id]/hr-handoff/route.ts', {
  ...common, '@/lib/hr/types': { HrMemberRole: { ADMIN: 'ADMIN' } },
  '@/lib/hr/access': { hasMinRole: (role, required) => role === required },
  '@/lib/hr/billing': { createWithinEmployeeLimit: async (org, callback) => {
    assert.equal(org, 'hr-X')
    const tx = { hrEmployee: { create: async ({ data }) => { writes.push(data); return { id: 'employee-1', lastName: data.lastName, firstName: data.firstName } } },
      mensetsuSession: { updateMany: async ({ where }) => { assert.equal(where.organizationId, 'org-B'); return { count: 1 } } } }
    return { allowed: true, value: await callback(tx) }
  }, employeeLimitMessage: () => 'synthetic limit' },
  '@/lib/hr/audit': { logAudit: async input => { auditCalls.push(input) } },
})
const request = (path, method = 'GET', body) => new Request(`https://example.invalid${path}`, { method, ...(body ? { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } } : {}) })
const ctx = id => ({ params: Promise.resolve({ id }) })
;(async () => {
  const bRecording = await recording.GET(request('/api/mensetsu/sessions/session-B/recording?org=B'), ctx('session-B'))
  assert.equal(bRecording.status, 200); assert.equal((await bRecording.json()).expiresInSec, 900)
  assert.deepEqual(signedCalls, ['recording-B'])
  assert.equal((await recording.GET(request('/api/mensetsu/sessions/session-A/recording?org=B'), ctx('session-A'))).status, 404)
  assert.equal(signedCalls.length, 1, 'foreign session must not reach storage signer')

  assert.equal((await pdf.GET(request('/api/mensetsu/sessions/session-B/pdf?org=B'), ctx('session-B'))).status, 200)
  assert.equal(pdfCalls[0].includeTranscript, false)
  assert.equal((await pdf.GET(request('/api/mensetsu/sessions/session-B/pdf?transcript=1&org=B'), ctx('session-B'))).status, 200)
  assert.equal(pdfCalls[1].includeTranscript, true)
  assert.equal((await pdf.GET(request('/api/mensetsu/sessions/session-A/pdf?org=B'), ctx('session-A'))).status, 404)
  assert.equal(pdfCalls.length, 2, 'foreign session must not reach PDF generation')

  const candidates = await handoff.GET(request('/api/mensetsu/sessions/session-B/hr-handoff?org=B'), ctx('session-B'))
  assert.equal(candidates.status, 200)
  assert.deepEqual((await candidates.json()).organizations.map(value => value.id), ['hr-X'])
  assert.equal((await handoff.POST(request('/api/mensetsu/sessions/session-B/hr-handoff?org=B', 'POST', { hrOrganizationId: 'hr-Y' }), ctx('session-B'))).status, 403)
  assert.equal(writes.length, 0)
  const accepted = await handoff.POST(request('/api/mensetsu/sessions/session-B/hr-handoff?org=B', 'POST', { hrOrganizationId: 'hr-X' }), ctx('session-B'))
  assert.equal(accepted.status, 200)
  assert.equal(writes.length, 1); assert.equal(writes[0].organizationId, 'hr-X')
  assert.equal(auditCalls.length, 1); assert.equal(auditCalls[0].organizationId, 'hr-X')
  assert.equal((await handoff.POST(request('/api/mensetsu/sessions/session-A/hr-handoff?org=B', 'POST', { hrOrganizationId: 'hr-X' }), ctx('session-A'))).status, 404)
  assert.equal(writes.length, 1)
  console.log('mensetsu actual sensitive routes: B recording/PDF2, foreign source0, B to independent HR X, foreign HR/ID write0 PASS')
})().catch(error => { console.error(error); process.exitCode = 1 })
