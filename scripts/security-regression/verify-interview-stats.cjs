const assert = require('node:assert/strict')
const { load } = require('./load-typescript.cjs')

const projects = Array.from({ length: 50 }, (_, i) => ({
  id: `project-${i}`, title: `Project ${i}`, status: 'DRAFT', _count: { materials: 1, drafts: 1 },
  drafts: [], transcriptions: [], createdAt: new Date(0), updatedAt: new Date(0),
}))
let owner = 'owner-1'
let countCalls = 0
let listCalls = 0
const prisma = {
  interviewProject: {
    findMany: async ({ where, take }) => { assert.equal(JSON.stringify(where), JSON.stringify(owner ? { userId: owner } : { guestId: 'guest-1' })); assert.equal(take, 50); listCalls++; return projects },
    count: async ({ where }) => { assert.equal(JSON.stringify(where), JSON.stringify(owner ? { userId: owner } : { guestId: 'guest-1' })); countCalls++; return 73 },
  },
  interviewDraft: { count: async ({ where }) => { assert.equal(JSON.stringify(where.project.is), JSON.stringify(owner ? { userId: owner } : { guestId: 'guest-1' })); countCalls++; return 140 } },
  interviewMaterial: { count: async ({ where }) => { assert.equal(JSON.stringify(where.project.is), JSON.stringify(owner ? { userId: owner } : { guestId: 'guest-1' })); countCalls++; return 80 } },
}
const route = load('src/app/api/interview/projects/route.ts', {
  'next/server': { NextResponse: { json: (body, options) => ({ body, status: options?.status ?? 200 }) } },
  '@/lib/prisma': { prisma },
  '@/lib/interview/access': {
    requireDatabase: () => null,
    getInterviewUser: async () => ({ userId: owner }),
    getGuestIdFromRequest: () => 'guest-1',
  },
})

;(async () => {
  const ordinary = await route.GET({ nextUrl: new URL('https://test.example/api/interview/projects') })
  assert.equal(ordinary.status, 200)
  assert.equal(ordinary.body.projects.length, 50)
  assert.equal(ordinary.body.stats, undefined)
  assert.equal(countCalls, 0)
  assert.equal(listCalls, 1)
  for (const expectedOwner of ['owner-1', null]) {
    owner = expectedOwner
    const response = await route.GET({ nextUrl: new URL('https://test.example/api/interview/projects?statsOnly=1') })
    assert.equal(response.status, 200)
    assert.equal(response.body.projects, undefined)
    assert.equal(JSON.stringify(response.body.stats), JSON.stringify({ totalProjects: 73, totalDrafts: 140, totalMaterials: 80 }))
  }
  assert.equal(countCalls, 6)
  assert.equal(listCalls, 1)
  console.log('PASS interview settings counts all owner records beyond the 50-item list cap')
})().catch(error => { console.error(error); process.exitCode = 1 })
