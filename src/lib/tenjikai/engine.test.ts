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

test('APIが成功したらその結果を使う', async () => {
  const body: GeneratedPlan = { source: 'ai', analysis: { ...analyzeSite('https://example.com'), brand: 'AI社' }, boothCopy: {}, creativeCopy: {} }
  const restore = stubFetch(async () => new Response(JSON.stringify(body), { status: 200 }))
  try {
    const g = await requestGeneratedPlan(SAMPLE_INPUT)
    assert.equal(g.source, 'ai')
    assert.equal(g.analysis.brand, 'AI社')
  } finally {
    restore()
  }
})

test('未ログイン・上限・通信失敗はモックにフォールバック', async () => {
  for (const [status, msg] of [[401, 'ログイン'], [429, '上限に達しました'], [500, '失敗']] as const) {
    const restore = stubFetch(async () => new Response(JSON.stringify(status === 429 ? { error: '上限に達しました。' } : {}), { status }))
    try {
      const g = await requestGeneratedPlan(SAMPLE_INPUT)
      assert.equal(g.source, 'mock')
      assert.ok(g.notice?.includes(msg), `${status}: ${g.notice}`)
      assert.equal(g.analysis.brand, analyzeSite(SAMPLE_INPUT.serviceUrl).brand)
    } finally {
      restore()
    }
  }
  const restore = stubFetch(async () => {
    throw new Error('offline')
  })
  try {
    assert.equal((await requestGeneratedPlan(SAMPLE_INPUT)).source, 'mock')
  } finally {
    restore()
  }
})
