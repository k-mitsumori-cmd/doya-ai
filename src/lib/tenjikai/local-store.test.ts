// 実行: npm run test:tenjikai
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SAMPLE_INPUT, mockGeneratedPlan } from './engine'
import { loadProject, loadProjectResult, saveProject, storeKey, type KeyValueStore } from './local-store'

const memory = (limit = Infinity): KeyValueStore & { data: Map<string, string> } => {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => {
      if (v.length > limit) throw new Error('QuotaExceededError')
      data.set(k, v)
    },
    removeItem: (k) => void data.delete(k),
  }
}
const project = (panelImages: Record<string, string> = {}) => ({
  input: SAMPLE_INPUT,
  generated: mockGeneratedPlan(SAMPLE_INPUT),
  variant: 'B' as const,
  selectedNovelty: ['a'],
  panelImages,
})

test('保存した内容を同じ利用者なら読み戻せる', () => {
  const s = memory()
  assert.equal(saveProject('u1', project({ p1: 'https://x/y.png' }), s), 'saved')
  const got = loadProject('u1', s)
  assert.equal(got?.variant, 'B')
  assert.equal(got?.panelImages.p1, 'https://x/y.png')
  assert.equal(got?.input.eventName, SAMPLE_INPUT.eventName)
})

test('利用者ごとにキーが違い、別の利用者には出ない', () => {
  const s = memory()
  saveProject('u1', project(), s)
  assert.notEqual(storeKey('u1'), storeKey('u2'))
  assert.equal(loadProject('u2', s), null)
})

test('容量が足りないときは data URL の画像だけ外して保存する', () => {
  const big = 'data:image/png;base64,' + 'A'.repeat(5000)
  const s = memory(JSON.stringify(project()).length + 500)
  assert.equal(saveProject('u1', project({ p1: big, p2: 'https://x/y.png' }), s), 'saved-without-images')
  const got = loadProject('u1', s)
  assert.equal(got?.panelImages.p1, undefined)
  assert.equal(got?.panelImages.p2, 'https://x/y.png')
})

test('壊れた内容・読めない入れ物でも例外を出さない', () => {
  const s = memory()
  s.setItem(storeKey('u1'), '{broken')
  assert.equal(loadProject('u1', s), null)
  assert.equal(loadProject('u1', null), null)
  assert.equal(saveProject('u1', project(), null), 'failed')
  const throwing: KeyValueStore = { getItem: () => { throw new Error('x') }, setItem: () => { throw new Error('x') }, removeItem: () => { throw new Error('x') } }
  assert.equal(loadProject('u1', throwing), null)
  assert.equal(saveProject('u1', project(), throwing), 'failed')
})

test('未保存・破損・利用不可を区別し、読み取りで保存内容を変更しない', () => {
  const s = memory()
  assert.equal(loadProjectResult('u1', s).status, 'missing')
  for (const raw of ['', '{broken', 'null', '[]', '{"v":1,"input":{},"generated":{"analysis":{}},"variant":"A","selectedNovelty":[]}']) {
    s.setItem(storeKey('u1'), raw)
    assert.equal(loadProjectResult('u1', s).status, 'invalid')
    assert.equal(s.getItem(storeKey('u1')), raw)
    assert.equal(loadProject('u1', s), null)
  }
  assert.equal(loadProjectResult('u1', null).status, 'unavailable')
  const unavailable: KeyValueStore = { ...s, getItem: () => { throw new Error('blocked') } }
  assert.equal(loadProjectResult('u1', unavailable).status, 'unavailable')
})

test('旧版の寸法省略と未知の付加情報を維持する', () => {
  const s = memory()
  const original = { ...project(), extraMetadata: { keep: 'unchanged' } }
  const legacy = { ...original, input: { ...original.input, extraInput: 'keep' }, generated: { ...original.generated, extraGenerated: 'keep' } }
  delete legacy.input.widthM
  delete legacy.input.depthM
  saveProject('u1', legacy, s)
  const raw = s.getItem(storeKey('u1'))
  const restored = loadProjectResult('u1', s)
  assert.equal(restored.status, 'ready')
  assert.equal(restored.project?.input.widthM, undefined)
  assert.deepEqual(restored.project, JSON.parse(raw!))
  assert.equal(s.getItem(storeKey('u1')), raw)
})

test('欠落・異なる型・非有限数のある保存形式を復元しない', () => {
  const original = { v: 1, savedAt: 123, ...project() }
  const mutations: Array<(p: any) => void> = [
    p => { p.v = 2 }, p => { delete p.savedAt }, p => { p.variant = 'D' },
    p => { p.input = {} }, p => { p.generated = { analysis: {} } },
    p => { p.selectedNovelty = [null] }, p => { p.input.eventStart = '2026-02-30' },
    p => { p.input.eventStart = 'invalid' }, p => { p.input.days = 9007199254740991 },
    p => { p.generated.source = 'unknown' }, p => { p.generated.notice = {} },
    p => { p.generated.analysis.valueProps = [] }, p => { p.generated.analysis.valueProps[0].title = {} },
    p => { p.generated.analysis.targets = [null] }, p => { p.generated.analysis.colors.primary = {} },
    p => { p.generated.boothCopy = null }, p => { p.generated.boothCopy.A = { name: 'only-name' } },
    p => { p.generated.creativeCopy = [] }, p => { p.generated.creativeCopy.flyer = { copy: 'missing-purpose' } },
    p => { p.input.position = ['inline'] }, p => { p.input.goal = ['lead'] },
    p => { p.generated.source = ['ai'] }, p => { p.variant = ['A'] },
    p => { p.input.widthM = 31 }, p => { p.input.depthM = 0.5 }, p => { p.input.widthM = 1.25 },
    p => { delete p.input.widthM; delete p.input.depthM; p.input.komaCols = 1000000 },
  ]
  for (const key of ['serviceUrl', 'eventName', 'venueId', 'eventStart']) mutations.push(p => { delete p.input[key] }, p => { p.input[key] = {} })
  for (const key of ['days', 'komaCols', 'komaRows', 'staff']) for (const bad of [0, -1, 1.5, null, '3']) mutations.push(p => { p.input[key] = bad })
  for (const key of ['brand', 'domain', 'category', 'headline', 'subline', 'tone']) mutations.push(p => { delete p.generated.analysis[key] })
  for (const key of ['widthM', 'depthM', 'budgetYen']) mutations.push(p => { p.input[key] = Infinity })
  for (const mutate of mutations) {
    const value = structuredClone(original)
    mutate(value)
    const raw = JSON.stringify(value), s = memory()
    s.setItem(storeKey('u1'), raw)
    assert.equal(loadProjectResult('u1', s).status, 'invalid', raw)
    assert.equal(s.getItem(storeKey('u1')), raw)
  }
})

test('有効なAI文面・うるう日・画像・未知のキーを失わない', () => {
  const s = memory(), value = project({ front: 'data:image/png;base64,synthetic' })
  value.input = { ...SAMPLE_INPUT, eventStart: '2028-02-29' }
  value.generated = { ...value.generated, source: 'ai', boothCopy: { A: { name: '名前', concept: '概念', flow: '順路' } }, creativeCopy: { flyer: { copy: '文面', purpose: '目的' } } }
  saveProject('u1', value, s)
  const raw = s.getItem(storeKey('u1'))!
  assert.deepEqual(loadProjectResult('u1', s).project, JSON.parse(raw))
  assert.equal(s.getItem(storeKey('u1')), raw)
})
