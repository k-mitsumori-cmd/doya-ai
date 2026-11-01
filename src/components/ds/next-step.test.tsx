// 実行: npx tsx --test src/components/ds/next-step.test.tsx
// 次にやること帯（NextStepBar）と手順の札（FlowSteps）の回帰テスト。git と環境変数は使わない。
// - 各ツールの文（next-step-copy.ts）が、4つの状態すべてで決まり（1文・30〜45字・絵文字なし・内部の言葉なし）に合う
// - 札の状態（済み・今・まだ）と aria-current="step"
// - 帯が読み上げの領域（aria-live）と見出しを持ち、高さを先に取る CSS と、動きを減らす設定の CSS がある
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import * as React from 'react'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { copyLength, flowStepState, nextStepCopyProblems, NEXT_STEP_STATES } from './next-step-model'
import { NEXT_STEP_COPY, NEXT_STEP_TOOLS, NEXT_STEP_SAMPLES } from './next-step-copy'

// CSS Modules は node では読めないので、クラス名をそのまま返す形にする
// eslint-disable-next-line -- node の require で CSS と部品を読む
require.extensions['.css'] = (m: NodeJS.Module) => { m.exports = { __esModule: true, default: new Proxy({}, { get: (_t, k) => String(k) }) } }
// tsx は古い JSX の変換（React.createElement）で部品を読むため、React を全体に置く
;(globalThis as { React?: typeof React }).React = React
// eslint-disable-next-line -- node の require で CSS と部品を読む
const { NextStepBar, NextStepAction, FlowSteps, ToolNextStep } = require('./next-step') as typeof import('./next-step')

const css = readFileSync(path.join(__dirname, 'next-step.module.css'), 'utf8')

test('置くと決めた8つのツールに、4つの状態の文がそろっている', () => {
  assert.deepEqual([...NEXT_STEP_TOOLS].sort(), ['adimage', 'banner', 'doyalist', 'doyaslide', 'interview', 'persona', 'seo', 'shodan'])
  for (const tool of NEXT_STEP_TOOLS) {
    for (const st of NEXT_STEP_STATES) assert.ok(NEXT_STEP_COPY[tool][st], `${tool} の ${st} が無い`)
  }
})

test('文は1文・30〜45字・絵文字なし・内部の言葉なし。数の入る文は、小さい数でも大きい数でも決まりに合う', () => {
  const problems: string[] = []
  for (const tool of NEXT_STEP_TOOLS) {
    for (const [key, make] of Object.entries(NEXT_STEP_COPY[tool])) {
      for (const n of NEXT_STEP_SAMPLES) {
        for (const p of nextStepCopyProblems(make(n))) problems.push(`${tool}.${key}(${n}): ${p}`)
      }
    }
  }
  assert.deepEqual(problems, [])
})

test('まだ・できた・エラーの状態には主ボタンがある（作成中は無くてもよい）', () => {
  for (const tool of NEXT_STEP_TOOLS) {
    for (const st of ['empty', 'done', 'error'] as const) assert.ok(NEXT_STEP_COPY[tool][st](1).action, `${tool} の ${st} にボタンが無い`)
  }
})

test('文の長さは1文字ずつ数える', () => {
  assert.equal(copyLength('あいう'), 3)
  assert.equal(copyLength('𠮷野家'), 3)
})

test('決まりに合わない文を見つける', () => {
  assert.ok(nextStepCopyProblems({ text: '短い。' }).length > 0)
  assert.ok(nextStepCopyProblems({ text: 'バナーを作りました。次は、サイズを選んで書き出しましょう。' }).some((p) => p.includes('2文')))
  assert.ok(nextStepCopyProblems({ text: 'バナーの生成に失敗しました（500 error）ので、もう一度試してください。' }).some((p) => p.includes('内部')))
  assert.ok(nextStepCopyProblems({ text: 'バナーができたので、開いてサイズを選び、書き出しましょう\u{1F389}。' }).some((p) => p.includes('絵文字')))
})

test('札の状態は、今より前が済み・今が今・後がまだ', () => {
  assert.deepEqual([0, 1, 2, 3].map((i) => flowStepState(i, 2)), ['done', 'done', 'now', 'next'])
  // 段の数と同じなら、すべて済み
  assert.deepEqual([0, 1, 2].map((i) => flowStepState(i, 3)), ['done', 'done', 'done'])
})

test('札は今の段だけに aria-current="step" を付け、済みの段に読み上げの「済み」を付ける', () => {
  const html = renderToStaticMarkup(createElement(FlowSteps, { steps: ['入れる', '確かめる', '作る', '書き出す'], current: 2, label: '進め方' }))
  assert.equal(html.match(/aria-current="step"/g)?.length, 1)
  assert.match(html, /aria-label="進め方"/)
  assert.equal(html.match(/済み：/g)?.length, 2)
  assert.match(html, /<li[^>]*data-state="now"[^>]*aria-current="step"[^>]*>.*?作る/)
})

test('帯は見出しと読み上げの領域を持ち、作成中は aria-busy とボタンの停止になる', () => {
  const html = renderToStaticMarkup(createElement(NextStepBar, {
    state: 'working',
    text: 'バナーを作っていて、できた順にこの下へ並びます。',
    // eslint-disable-next-line react/no-children-prop
    action: createElement(NextStepAction, { busy: true, onClick: () => {}, children: '作っています' }),
  }))
  assert.match(html, /<section[^>]*aria-label="次にやること"/)
  assert.match(html, /aria-busy="true"/)
  assert.match(html, /aria-live="polite"/)
  assert.match(html, /<button[^>]*disabled=""/)
  // 主ボタンは1つだけ
  assert.equal(html.match(/<button/g)?.length, 1)
})

test('帯のボタンは、行き先があればリンクになる（キーボードで Tab と Enter で動く）', () => {
  // eslint-disable-next-line react/no-children-prop
  const html = renderToStaticMarkup(createElement(NextStepAction, { href: '/seo/create', children: '記事を作る' }))
  assert.match(html, /<a[^>]*href="\/seo\/create"/)
})

test('CSS は高さを先に取り、動きを減らす設定では動かさない', () => {
  assert.match(css, /\.bar \{[^}]*min-height: 76px/)
  assert.match(css, /\.live \{ min-height:/)
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{[^}]*\.sentence, \.spin \{ animation: none; \}/)
  assert.match(css, /\.primary:focus-visible/)
})

test('ツールの帯は、読み込み中は高さだけ取り、状態が決まると表の文とボタンを出す', () => {
  const loading = renderToStaticMarkup(createElement(ToolNextStep, { tool: 'seo', view: null }))
  assert.match(loading, /placeholder/)
  assert.match(loading, /aria-busy="true"/)
  assert.doesNotMatch(loading, /<a |<button/)
  const empty = renderToStaticMarkup(createElement(ToolNextStep, { tool: 'seo', view: { key: 'empty', state: 'empty', href: '/seo/create' } }))
  assert.ok(empty.includes(NEXT_STEP_COPY.seo.empty(0).text))
  assert.match(empty, /<a[^>]*href="\/seo\/create"[^>]*>.*記事を作る/)
  // 作成中でボタンの文が無いときは、行き先があってもボタンを出さない
  const working = renderToStaticMarkup(createElement(ToolNextStep, { tool: 'persona', view: { key: 'working', state: 'working', onClick: () => {} } }))
  assert.doesNotMatch(working, /<button|<a /)
})
