// 実行: npx tsx --test src/components/shell-next/panel.test.ts
// パネルの開閉の決まり（URL のハッシュ）と、見本の振り分けの回帰テスト。画面は描かない。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isPanelKey, panelHash, panelKeyOf, parsePanelKey, readPanelKey } from './panel-hash'
import { DEMO_ACTIONS, actionOfTool, demoRoute, readYen } from './demo-route'

test('ハッシュ: #p=<鍵> を読み書きし、形の違う鍵・知らない種類は読まない', () => {
  assert.equal(panelHash('metric:0'), '#p=metric:0')
  assert.equal(readPanelKey('#p=metric:0'), 'metric:0')
  assert.equal(readPanelKey('p=tool:banner'), 'tool:banner')
  assert.equal(readPanelKey(''), null)
  assert.equal(readPanelKey('#other=1'), null)
  assert.equal(readPanelKey('#p=<script>'), null)
  assert.equal(readPanelKey('#p=' + 'a'.repeat(41)), null)
  assert.equal(panelHash('../x'), '')
  assert.equal(isPanelKey('ask'), true)
  assert.equal(isPanelKey('Metric:0'), false)
})

test('鍵 → パネル: 種類と対象を分け、対象の無いもの・知らない種類は null。ask は対象を持たない', () => {
  assert.deepEqual(parsePanelKey('metric:2'), { kind: 'metric', id: '2' })
  assert.deepEqual(parsePanelKey('tool:banner'), { kind: 'tool', id: 'banner' })
  assert.deepEqual(parsePanelKey('report:marketing'), { kind: 'report', id: 'marketing' })
  assert.deepEqual(parsePanelKey('ask'), { kind: 'ask', id: '' })
  assert.equal(parsePanelKey('ask:x'), null)
  assert.equal(parsePanelKey('metric'), null)
  assert.equal(parsePanelKey('evil:1'), null)
  assert.equal(parsePanelKey(null), null)
  for (const k of ['metric:0', 'decision:d1', 'report:hr', 'tool:quote', 'ask']) assert.equal(panelKeyOf(parsePanelKey(k)!), k)
})

test('鍵に値を入れない: 「頼む」の依頼の文や金額は、鍵にもハッシュにも出ない', () => {
  assert.equal(panelHash('ask'), '#p=ask')
  assert.ok(!panelHash('ask').includes('20'))
})

test('金額: 万・千・カンマを円で読み、読めない・負・大きすぎる値は空', () => {
  assert.equal(readYen('20万円の支出'), '200000')
  assert.equal(readYen('200,000円'), '200000')
  assert.equal(readYen('３千円'), '3000')
  assert.equal(readYen('金額は未定'), '')
  assert.equal(readYen('0円'), '')
  assert.equal(readYen('99999億円'), '')
})

test('見本の振り分け: 「20万円の支出を登録したい」は支出の登録に金額を入れ、必須の欄は満たされる', () => {
  const r = demoRoute('20万円の支出を登録したい')
  assert.equal(r?.action.id, 'expense.contract.create')
  assert.deepEqual(r?.values, { amount: '200000' })
  assert.equal(r?.action.fields.filter((f) => f.required && !r.values[f.key]).length, 0)
  assert.equal(r?.action.finalStep, '契約を登録する')
})

test('見本の振り分け: 値が足りなければ必須の欄が残り、合わない依頼は null', () => {
  const r = demoRoute('SEO記事を書きたい')
  assert.equal(r?.action.id, 'seo.article.create')
  assert.deepEqual(r?.values, {})
  assert.deepEqual(r?.action.fields.filter((f) => f.required && !r.values[f.key]).map((f) => f.key), ['keyword'])
  assert.equal(demoRoute('今日の天気は？'), null)
  assert.equal(demoRoute(''), null)
  assert.equal(demoRoute('https://example.co.jp の商談の準備')?.values.url, 'https://example.co.jp')
})

test('見本の操作の一覧: id は重ならず、ツールのパネルは最初の操作を使う', () => {
  assert.equal(new Set(DEMO_ACTIONS.map((a) => a.id)).size, DEMO_ACTIONS.length)
  assert.equal(actionOfTool('banner')?.id, 'banner.create')
  assert.equal(actionOfTool('kintai'), null)
})
