// 実行: npx tsx --test src/components/shell-next/model.test.ts
// 部署別の枠（見本）の、画面に依らない部品の回帰テスト。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEPARTMENTS } from '@/lib/departments'
import { ALL_SHELL_TOOLS } from '@/components/shell/tools'
import { COMPANY_METRICS, DEPT_KUN, DEPT_LABEL, DEPT_REPORTS, FAVORITE_TOOLS, MARKETING_VIEW, MOBILE_ITEMS, SIDEBAR_ITEMS, pickFavorites } from './model'

test('サイドバーは7項目: 経営ホーム・4つの部署・道具箱・設定。部署の並びは部署の表と同じ', () => {
  assert.deepEqual(SIDEBAR_ITEMS.map((i) => i.key), ['home', ...DEPARTMENTS.map((d) => d.id), 'tools', 'settings'])
  assert.equal(SIDEBAR_ITEMS.length, 7)
  for (const d of DEPARTMENTS) {
    const it = SIDEBAR_ITEMS.find((i) => i.key === d.id)
    assert.equal(it?.label, DEPT_LABEL[d.id])
    assert.equal(it?.kun, DEPT_KUN[d.id], '部署長のドヤくんが付く')
  }
})

test('スマホの下のボタンは5つ: ホーム・部署・頼む・道具箱・設定', () => {
  assert.deepEqual(MOBILE_ITEMS.map((m) => m.label), ['ホーム', '部署', '頼む', '道具箱', '設定'])
})

test('部署の表のツールは、どれも実在し、マーケ部の部員と部署の表が合う', () => {
  const known = new Set(ALL_SHELL_TOOLS.map((t) => t.id))
  for (const d of DEPARTMENTS) for (const id of d.toolIds) assert.ok(known.has(id), `ツールが無い: ${id}`)
  const marketing = DEPARTMENTS.find((d) => d.id === 'marketing')!
  // 並びは見本の判断（よく使いそうな順）。部署の表と同じツールが、過不足なく入っていることを確かめる
  assert.deepEqual(MARKETING_VIEW.members.map((m) => m.toolId).sort(), [...marketing.toolIds].sort())
  for (const f of FAVORITE_TOOLS) assert.ok(known.has(f.toolId))
})

test('数字は仮のもの: どの数字にも前の週との増減があり、悪い方向には「要確認」を出す材料がある', () => {
  for (const m of [...COMPANY_METRICS, ...MARKETING_VIEW.metrics]) {
    assert.ok(m.delta, `増減が無い: ${m.label}`)
    assert.ok(['up', 'down', 'flat'].includes(m.delta.tone))
  }
  assert.ok(COMPANY_METRICS.some((m) => m.delta && !m.delta.good), '良くない数字も1つは見本に入れる')
  assert.equal(DEPT_REPORTS.length, DEPARTMENTS.length, '部署ごとに1行の報告')
})

test('よく使う: 最近使った順に最大3つ。重複は1つ、知らない id は捨てる', () => {
  const known = ['banner', 'quote', 'income', 'seo']
  assert.deepEqual(pickFavorites(['quote', 'banner', 'quote', 'x', 'income', 'seo'], known), ['quote', 'banner', 'income'])
  assert.deepEqual(pickFavorites([], known), [])
  assert.deepEqual(pickFavorites(['seo'], known, 3), ['seo'])
  assert.deepEqual(pickFavorites(['banner', 'quote', 'income', 'seo'], known, 2), ['banner', 'quote'])
})
