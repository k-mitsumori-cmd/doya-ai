// 実行: npx tsx --test src/components/shell/heading-guard.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { demoteExtraH1 } from './heading-guard'

const dom = (html: string) => new JSDOM(`<main>${html}</main>`).window.document.querySelector('main')!

test('h1 が1つなら何もしない', () => {
  const m = dom('<h1>ひとつ</h1>')
  assert.equal(demoteExtraH1(m), 0)
  assert.equal(m.querySelector('h1')!.getAttribute('role'), null)
})

test('ToolFrame の h1 を残し、ほかを2段目にする', () => {
  const m = dom('<h1>ページの古い見出し</h1><div><h1 data-shell-title>ツール名</h1></div><h1>もう1つ</h1>')
  assert.equal(demoteExtraH1(m), 2)
  const [a, b, c] = Array.from(m.querySelectorAll('h1'))
  assert.equal(a.getAttribute('aria-level'), '2')
  assert.equal(b.getAttribute('aria-level'), null)
  assert.equal(c.getAttribute('aria-level'), '2')
  // 2回目は何も変えない（MutationObserver で繰り返し呼ばれても止まる）
  assert.equal(demoteExtraH1(m), 0)
})

test('ToolFrame が無ければ最初の h1 を残す', () => {
  const m = dom('<h1>最初</h1><h1>次</h1>')
  demoteExtraH1(m)
  assert.equal(m.querySelectorAll('h1')[0].getAttribute('aria-level'), null)
  assert.equal(m.querySelectorAll('h1')[1].getAttribute('aria-level'), '2')
})
