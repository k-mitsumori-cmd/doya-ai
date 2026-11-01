// ペルソナ画像の原価対策の確認。有料の画像APIはモックで数え、実際には呼ばない。
// 1) 文章を作った直後に自動で作る画像は肖像1枚だけ（シーン画像はボタンを押したときだけ）。
// 2) 無料プランの付属枠は肖像1枚＋シーン2枚まで。1日の上限を超えると画像APIを呼ばない。
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict')
const ts = require('typescript')
const { load } = require('./load-typescript.cjs')

const entitlements = load('src/lib/persona/image-entitlements.ts')
const unified = load('src/lib/unified-plan.ts')

function verifyAutoGenerationAfterText() {
  const source = fs.readFileSync(path.resolve(__dirname, '../../src/app/(shell)/persona/Tool.tsx'), 'utf8')
  const ast = ts.createSourceFile('Tool.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const effects = []
  const visit = n => { if (ts.isCallExpression(n) && n.expression.getText(ast) === 'useEffect') effects.push(n.arguments[0].getText(ast)); ts.forEachChild(n, visit) }
  visit(ast)
  const imageEffects = effects.filter(s => s.includes('handleGeneratePortrait') || s.includes('handleGenerateScene'))
  assert.ok(imageEffects.length >= 1)
  const data = {
    persona: { name: 'Synthetic', age: 30, gender: '男性', occupation: 'Example',
      schedule: [{ imagePrompt: 's0' }, { imagePrompt: 's1' }, { imagePrompt: 's2' }],
      diary: { imageScenes: ['d0', 'd1'] }, painPoints: [{ imagePrompt: 'p0' }] },
    deepDive: { adoptionStory: { timeline: [{ imagePrompt: 'a0' }] } }, summary: { oneLiner: 'x' },
  }
  const timers = new Set(), apiCalls = []
  const env = {
    includedPersonaImages: entitlements.includedPersonaImages,
    generatedData: data, autoGenerateFor: { current: data },
    portraitAutoTriggered: { current: false }, sceneAutoTriggered: { current: false },
    portraitImage: null, portraitLoading: false, sceneImages: {}, imageGenerationRequest: 0,
    handleGeneratePortrait: () => apiCalls.push('/api/persona/portrait'),
    handleGenerateScene: (_prompt, key) => apiCalls.push('/api/persona/scene:' + key),
    setTimeout: fn => { timers.add(fn); return fn }, clearTimeout: fn => timers.delete(fn),
  }
  for (const effect of imageEffects) {
    vm.runInNewContext(ts.transpileModule('(' + effect + ');', { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, env)()
  }
  for (const fn of timers) fn()
  assert.deepEqual(apiCalls, ['/api/persona/portrait'])
  console.log('PASS after text generation the image API is called exactly once (portrait only)')
}

function makeWorld({ plan, includedUsedToday }) {
  const grants = entitlements.includedPersonaImages({
    persona: { schedule: [{ imagePrompt: 's0' }, { imagePrompt: 's1' }, { imagePrompt: 's2' }], diary: { imageScenes: ['d0'] } },
  })
  let created = 0
  const tx = {
    $queryRaw: async () => [{ id: 'owner' }],
    user: { findUnique: async () => ({ plan }) },
    personaProject: { findFirst: async () => ({ id: 'project', includedImages: grants }) },
    personaImageJob: {
      findMany: async () => [],
      findUnique: async () => null,
      findFirst: async () => ({ id: 'job', intent: 'included', usageDay: new Date('2026-10-18T15:00:00Z') }),
      count: async ({ where }) => {
        assert.equal(where.intent, 'included')
        assert.equal(where.project.userId, 'owner')
        assert.deepEqual([...where.status.in], ['pending', 'succeeded'])
        return includedUsedToday
      },
      create: async ({ data }) => { created++; return { id: 'job', ...data } },
      updateMany: async () => ({ count: 1 }),
    },
    personaImageUsageDay: {
      upsert: async () => ({ used: 0, reserved: 0 }), update: async () => {}, updateMany: async () => ({ count: 1 }),
    },
  }
  const db = { $transaction: async work => work(tx) }
  const ledger = load('src/lib/persona/image-ledger.ts', {
    crypto: require('node:crypto'),
    '@/lib/unified-plan': unified,
    './image-entitlements': entitlements,
    './usage-day': load('src/lib/persona/usage-day.ts'),
    './project-ledger': { releasePersonaProjectReservation: async () => {} },
  })
  const counter = { provider: 0 }
  const service = load('src/lib/persona/image-generation.ts', {
    crypto: require('node:crypto'),
    'next/server': { NextResponse: Response },
    '@/lib/prisma': { prisma: db },
    '@/lib/resolve-image-model': { callGeminiImageAPI: async () => {
      counter.provider++
      return { response: Response.json({ candidates: [{ content: { parts: [{ inlineData: { data: 'c3ludGhldGlj' } }] } }] }) }
    } },
    './image-ledger': ledger,
    './image-storage': {
      assertPersonaImageStorage: async () => {}, normalizePersonaImage: async () => Buffer.from('png'),
      savePersonaImageFile: async () => {}, removePersonaImageFile: async () => {},
    },
    '@/lib/pricing': { SUPPORT_CONTACT_URL: 'https://example.test/contact' },
  })
  return { service, counter, created: () => created }
}

async function request(world, slotKey, kind = 'scene', intent = 'included') {
  const input = { userId: 'owner', projectId: 'project', requestKey: 'req-' + slotKey, slotKey, kind, intent, persona: { name: 'Synthetic' } }
  const response = await world.service.generateAndSavePersonaImage(input, { contents: [{ parts: [{ text: slotKey }] }] })
  return { status: response.status, body: await response.json() }
}

async function verifyServerLimits() {
  // 無料・上限内: 付属枠の肖像とシーン2枚は作れる（画像APIは1回ずつ）。
  for (const slot of [['portrait', 'portrait'], ['schedule-0', 'scene'], ['schedule-1', 'scene']]) {
    const world = makeWorld({ plan: 'FREE', includedUsedToday: 0 })
    const res = await request(world, slot[0], slot[1])
    assert.equal(res.status, 200, slot[0])
    assert.equal(world.counter.provider, 1)
  }
  console.log('PASS free plan: portrait and first two scenes are included (one provider call each)')

  // 無料・3枚目のシーン: 付属枠の外。included では作らず、画像APIを呼ばない。
  {
    const world = makeWorld({ plan: 'FREE', includedUsedToday: 0 })
    const res = await request(world, 'schedule-2')
    assert.equal(res.status, 400)
    assert.equal(res.body.code, 'NOT_INCLUDED')
    assert.equal(world.counter.provider, 0)
    assert.equal(world.created(), 0)
  }
  console.log('PASS free plan: third scene is not included and the provider is not called')

  // 無料・1日の付属枠の上限に達した: 画像APIを呼ばない。
  {
    const world = makeWorld({ plan: 'FREE', includedUsedToday: 8 })
    const res = await request(world, 'portrait', 'portrait')
    assert.equal(res.status, 429)
    assert.equal(res.body.code, 'DAILY_LIMIT_REACHED')
    assert.equal(res.body.dailyLimit, 8)
    assert.ok(res.body.error.includes('付属画像'))
    assert.ok(res.body.upgradeUrl)
    assert.equal(world.counter.provider, 0)
    assert.equal(world.created(), 0)
  }
  console.log('PASS free plan over the daily included cap: provider is not called')

  // 有料: 3枚目のシーンも付属枠。上限は40枚。
  {
    const world = makeWorld({ plan: 'PRO', includedUsedToday: 8 })
    assert.equal((await request(world, 'schedule-2')).status, 200)
    assert.equal(world.counter.provider, 1)
    const capped = makeWorld({ plan: 'PRO', includedUsedToday: 40 })
    assert.equal((await request(capped, 'schedule-2')).status, 429)
    assert.equal(capped.counter.provider, 0)
  }
  console.log('PASS paid plan: all slots included, daily included cap of 40 enforced')

  // クライアントのボタンが送る意図: 無料の3枚目は追加枠、画像があれば再生成。
  const data = { persona: { schedule: [{ imagePrompt: 's0' }, { imagePrompt: 's1' }, { imagePrompt: 's2' }] } }
  assert.equal(entitlements.personaSceneIntent(data, 'schedule-1', false, false), 'included')
  assert.equal(entitlements.personaSceneIntent(data, 'schedule-2', false, false), 'extra')
  assert.equal(entitlements.personaSceneIntent(data, 'schedule-2', false, true), 'included')
  assert.equal(entitlements.personaSceneIntent(data, 'schedule-0', true, false), 'regenerate')
  console.log('PASS scene button intent follows the plan allowance')
}

;(async () => { verifyAutoGenerationAfterText(); await verifyServerLimits() })().catch(error => { console.error(error); process.exitCode = 1 })
