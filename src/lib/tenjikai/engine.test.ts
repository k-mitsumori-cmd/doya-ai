// 実行: npm run test:tenjikai
// LLM・課金APIは呼ばない。fetch を差し替えて、画面側のフォールバックと文面の重ね合わせを確かめる。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  SAMPLE_INPUT,
  applyBoothCopy,
  applyCreativeCopy,
  generateBoothPlans,
  generateCreatives,
  analyzeSite,
  planCost,
  requestGeneratedPlan,
  type GeneratedPlan,
} from './engine'

function stubFetch(impl: () => Promise<Response>) {
  const orig = globalThis.fetch
  globalThis.fetch = impl as typeof fetch
  return () => {
    globalThis.fetch = orig
  }
}

test('AIの文面を重ねても寸法・金額はルール計算のまま', () => {
  const plans = generateBoothPlans(SAMPLE_INPUT)
  const merged = applyBoothCopy(plans, { B: { name: '別名', concept: '別コンセプト', flow: '通路 → 着席' } })
  assert.equal(merged[1].name, '別名')
  assert.equal(merged[0].name, plans[0].name)
  assert.deepEqual(merged[1].elements, plans[1].elements)
  assert.equal(planCost(merged[1], SAMPLE_INPUT).total, planCost(plans[1], SAMPLE_INPUT).total)

  const creatives = generateCreatives(analyzeSite(SAMPLE_INPUT.serviceUrl), SAMPLE_INPUT)
  const mc = applyCreativeCopy(creatives, { flyer: { copy: '新コピー', purpose: '新しい狙い' } })
  const flyer = mc.find((c) => c.kind === 'flyer')!
  assert.equal(flyer.copy, '新コピー')
  assert.equal(flyer.qty, creatives.find((c) => c.kind === 'flyer')!.qty)
})

const REQUEST_ID = 'b7d7a6e2-36bf-4c3d-9ec6-1a51afc24175'
const OPERATION_ID = '1792537200000.b7d7a6e2-36bf-4c3d-9ec6-1a51afc24175'
const ACTOR = 'actor-a'

test('APIが成功したらactor/request/project/save範囲を検証して返す', async () => {
  const body: GeneratedPlan = { source: 'ai', analysis: { ...analyzeSite('https://example.com'), brand: 'AI社' }, boothCopy: {}, creativeCopy: {} }
  const restore = stubFetch(async () => new Response(JSON.stringify({ state: 'generated', actorId: ACTOR, clientRequestId: REQUEST_ID, operationId: OPERATION_ID,
    projectId: 'project-a', plan: body, save: { project: 'basic', venue: 'not_saved', analysis: 'saved', plan: 'not_saved' } }), { status: 200 }))
  try {
    const g = await requestGeneratedPlan(SAMPLE_INPUT, ACTOR, OPERATION_ID, REQUEST_ID)
    assert.equal(g.state, 'generated')
    if (g.state === 'generated') { assert.equal(g.plan.analysis.brand, 'AI社'); assert.equal(g.projectId, 'project-a') }
  } finally {
    restore()
  }
})

test('認証・上限・DB・通信・不正応答は成功風の下書きを返さない', async () => {
  for (const status of [401, 429, 500]) {
    const restore = stubFetch(async () => new Response(JSON.stringify({ error: 'Synthetic failure' }), { status }))
    try {
      const g = await requestGeneratedPlan(SAMPLE_INPUT, ACTOR, OPERATION_ID, REQUEST_ID)
      assert.equal(g.state, status === 401 ? 'auth_changed' : 'outcome_unknown')
      assert.equal(g.projectId, null)
    } finally {
      restore()
    }
  }
  const restore = stubFetch(async () => {
    throw new Error('offline')
  })
  try {
    assert.equal((await requestGeneratedPlan(SAMPLE_INPUT, ACTOR, OPERATION_ID, REQUEST_ID)).state, 'outcome_unknown')
  } finally {
    restore()
  }
})

test('開いたままの応答bodyをclient abortで止め、POSTを再送しない', async () => {
  let calls = 0
  let started = () => {}
  const sent = new Promise<void>(resolve => { started = resolve })
  const restore = stubFetch(async () => {
    calls++
    started()
    return new Response(new ReadableStream<Uint8Array>({ start(controller) {
      controller.enqueue(new TextEncoder().encode('{"state":"generated"'))
    } }), { status: 200 })
  })
  const controller = new AbortController()
  try {
    const pending = requestGeneratedPlan(SAMPLE_INPUT, ACTOR, OPERATION_ID, REQUEST_ID, controller.signal)
    await sent
    controller.abort()
    assert.equal((await pending).state, 'outcome_unknown')
    assert.equal(calls, 1)
  } finally { restore() }
})

test('応答bodyの上限超過も結果不明で止める', async () => {
  let calls = 0
  const restore = stubFetch(async () => { calls++; return new Response('x'.repeat(128 * 1024 + 1), { status: 200 }) })
  try {
    assert.equal((await requestGeneratedPlan(SAMPLE_INPUT, ACTOR, OPERATION_ID, REQUEST_ID)).state, 'outcome_unknown')
    assert.equal(calls, 1)
  } finally { restore() }
})
