const assert = require('node:assert/strict')
const { load, check } = require('./load-typescript.cjs')

const templates = []
let nextId = 0
let generateCalls = 0
let failGenerate = false
let failSave = false
let waitForGeneration
let releaseGeneration
const pendingStatus = 'generating'

function matches(row, where) {
  if (where.organizationId && row.organizationId !== where.organizationId) return false
  if (where.id && row.id !== where.id) return false
  if (typeof where.status === 'string' && row.status !== where.status) return false
  if (where.status?.not && row.status === where.status.not) return false
  if (where.createdAt?.lt && !(row.createdAt < where.createdAt.lt)) return false
  return true
}
const templateModel = {
  findFirst: async ({ where }) => templates.find((row) => matches(row, where)) || null,
  findMany: async ({ where }) => templates.filter((row) => matches(row, where)),
  count: async ({ where }) => templates.filter((row) => matches(row, where)).length,
  create: async ({ data }) => {
    const row = { id: `template-${++nextId}`, createdAt: new Date(), ...data }
    templates.push(row)
    return row
  },
  update: async ({ where, data }) => {
    if (failSave) throw Error('save failed')
    const row = templates.find((item) => item.id === where.id)
    Object.assign(row, data)
    return { ...row, questions: [{ id: 'question-1' }], criteria: [{ id: 'criterion-1' }] }
  },
  deleteMany: async ({ where }) => {
    for (let i = templates.length - 1; i >= 0; i--) if (matches(templates[i], where)) templates.splice(i, 1)
  },
}
const prisma = {
  mensetsuTemplate: templateModel,
  mensetsuCompanyProfile: { findFirst: async () => null },
  $transaction: async (callback, options) => {
    assert.equal(options.isolationLevel, 'Serializable')
    return callback({ mensetsuTemplate: templateModel })
  },
}
const route = load('src/app/api/mensetsu/templates/route.ts', {
  'next/server': { NextResponse: Response },
  '@/lib/prisma': { prisma },
  '@/lib/plan-limit': { FREE_LIMITS: { mensetsuTemplates: 1 }, assertFreeLimit: async (_key, count) => {
    const used = await count()
    return used >= 1 ? { ok: false, used, limit: 1, reason: '無料枠に達しました' } : { ok: true, used, limit: 1 }
  } },
  '@/lib/mensetsu/access': { getMensetsuContext: async () => ({ organizationId: 'org' }), orgSlugFrom: () => 'org' },
  '@/lib/mensetsu/template': { generateTemplate: async () => {
    generateCalls++
    if (waitForGeneration) await waitForGeneration
    if (failGenerate) throw Error('provider failed')
    return { template: { intro: 'Hi', closing: 'Bye', criteria: [{ key: 'skill', name: 'Skill', weight: 1, rubric: {} }], questions: [{ text: 'Question', targetMin: 2, criterionKeys: ['skill'] }] }, removed: [] }
  } },
})
const post = () => route.POST(new Request('http://offline.invalid/api/mensetsu/templates', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jobTitle: '営業' }),
}))

;(async () => {
  await check('pending question set is hidden and concurrent request makes no second AI call', async () => {
    waitForGeneration = new Promise((resolve) => { releaseGeneration = resolve })
    const first = post()
    for (let i = 0; i < 20 && generateCalls === 0; i++) await new Promise((resolve) => setTimeout(resolve, 0))
    assert.equal(generateCalls, 1)
    assert.equal(templates[0].status, pendingStatus)
    const list = await route.GET(new Request('http://offline.invalid/api/mensetsu/templates'))
    assert.equal((await list.json()).templates.length, 0)
    const duplicate = await post()
    assert.equal(duplicate.status, 409)
    assert.equal((await duplicate.json()).code, 'GENERATION_IN_PROGRESS')
    assert.equal(generateCalls, 1)
    releaseGeneration()
    waitForGeneration = null
    assert.equal((await first).status, 200)
    assert.equal(templates[0].status, 'draft')
  })
  await check('free cap blocks provider and returns pricing route', async () => {
    const blocked = await post()
    assert.equal(blocked.status, 402)
    assert.equal((await blocked.json()).upgradeUrl, '/mensetsu/pricing')
    assert.equal(generateCalls, 1)
  })
  await check('provider and save failures release the reserved slot', async () => {
    templates.length = 0
    failGenerate = true
    assert.equal((await post()).status, 502)
    assert.equal(templates.length, 0)
    failGenerate = false
    failSave = true
    assert.equal((await post()).status, 502)
    assert.equal(templates.length, 0)
    failSave = false
    assert.equal((await post()).status, 200)
  })
})().catch((error) => { console.error(error); process.exitCode = 1 })
