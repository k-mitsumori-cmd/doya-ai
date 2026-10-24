// 実行: npm run test:tenjikai
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SAMPLE_INPUT, mockGeneratedPlan } from './engine'
import { loadProject, saveProject, storeKey, type KeyValueStore } from './local-store'

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
