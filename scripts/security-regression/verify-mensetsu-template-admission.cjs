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
  '@/lib/organization-billing': { getOrganizationOwnerUserId: async () => 'user' },
  '@/lib/plan-limit': { FREE_LIMITS: { mensetsuTemplates: 1 }, assertFreeLimit: async (_key, count) => {
    const used = await count()
    return used >= 1 ? { ok: false, used, limit: 1, reason: '無料枠に達しました' } : { ok: true, used, limit: 1 }
  } },
  '@/lib/mensetsu/access': { getMensetsuContext: async () => ({ organizationId: 'org', userId: 'user', role: 'owner' }), orgSlugFrom: () => 'org' },
  '@/lib/mensetsu/template': { generateTemplate: async () => {
    generateCalls++
    if (waitForGeneration) await waitForGeneration
    if (failGenerate) throw Error('provider failed')
    return { template: { intro: 'Hi', closing: 'Bye', criteria: [{ key: 'skill', name: 'Skill', weight: 1, rubric: {} }], questions: [{ text: 'Question', targetMin: 2, criterionKeys: ['skill'] }] }, removed: [] }
  } },
})
const post = (body = { jobTitle: '営業' }) => route.POST(new Request('http://offline.invalid/api/mensetsu/templates', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
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
  await check('oversized template inputs do not reach the provider', async () => {
    templates.length = 0
    const before = generateCalls
    assert.equal((await post({ jobTitle: '営'.repeat(201) })).status, 400)
    assert.equal((await post({ jobTitle: '営業', focus: '重'.repeat(1001) })).status, 400)
    assert.equal(generateCalls, before)
    assert.equal(templates.length, 0)
  })
  await check('model overflow cannot exceed interview time or create invalid jumps', async () => {
    const raw = {
      criteria: Array.from({ length: 8 }, (_, i) => ({ key: `c${i}`, name: `Criterion ${i}`, rubric: {}, weight: 1 })),
      questions: Array.from({ length: 12 }, (_, i) => ({
        text: `Question ${i}`, targetMin: 3, criterionKeys: ['c0'],
        branches: [{ label: 'branch', matchHint: 'hint', text: 'follow-up', skipTo: i === 0 ? 12 : i === 1 ? 1 : 4 }],
      })),
      intro: 'intro', closing: 'closing',
    }
    const generator = load('src/lib/mensetsu/template.ts', {
      '@seo/lib/gemini': { GEMINI_TEXT_MODEL_DEFAULT: 'test', geminiGenerateJson: async () => raw },
      './guardrails': { GUARDRAIL_PROMPT: '', stripViolations: (items) => ({ kept: items, removed: [] }), findViolations: () => [] },
      './types': { LEVEL_LABELS: { mid: '中途' } },
    })
    const { template } = await generator.generateTemplate({ profile: {}, jobTitle: '営業', level: 'mid', durationMin: 10 })
    assert.equal(template.criteria.length, 7)
    assert.equal(template.questions.length, 4)
    assert.ok(template.questions.reduce((total, question) => total + question.targetMin, 0) <= 6)
    assert.equal(template.questions[0].branches[0].skipTo, null)
    assert.equal(template.questions[1].branches[0].skipTo, null)
    assert.equal(template.questions[2].branches[0].skipTo, 4)
    const filtered = {
      ...raw,
      questions: [
        { text: 'forbidden', targetMin: 1 },
        { text: 'kept first', targetMin: 2, branches: [{ label: 'branch', matchHint: 'hint', skipTo: 4 }] },
        { text: 'kept second', targetMin: 2 },
        { text: 'kept third', targetMin: 2 },
      ],
    }
    const filteredGenerator = load('src/lib/mensetsu/template.ts', {
      '@seo/lib/gemini': { GEMINI_TEXT_MODEL_DEFAULT: 'test', geminiGenerateJson: async () => filtered },
      './guardrails': { GUARDRAIL_PROMPT: '', stripViolations: (items) => ({ kept: items.filter((item) => item.text !== 'forbidden'), removed: [{ text: 'forbidden', label: 'blocked' }] }), findViolations: () => [] },
      './types': { LEVEL_LABELS: { mid: '中途' } },
    })
    const safe = await filteredGenerator.generateTemplate({ profile: {}, jobTitle: '営業', level: 'mid', durationMin: 10 })
    assert.equal(safe.template.questions.length, 3)
    assert.equal(safe.template.questions[0].branches[0].skipTo, 3)
  })
})().catch((error) => { console.error(error); process.exitCode = 1 })
