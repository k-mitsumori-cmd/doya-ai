// 実行: npx tsx --test src/lib/agent-router/catalog.test.ts
// ドヤAIが選べる操作の一覧と、組織の入口が値を運ぶ部品の回帰テスト。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { AGENT_ACTIONS, AGENT_PLAN_OPTIONS, fallbackRoute, routeResponse } from './catalog'
import { forwardPath, toSearchParams } from './entry'

/** /expense/... を src/app/(shell)/expense/... のページの有無で確かめる（[param] は1段のフォルダ） */
function routeExists(path: string): boolean {
  const base = join(process.cwd(), 'src/app/(shell)', path.split('?')[0])
  return existsSync(join(base, 'page.tsx'))
}

test('一覧: 操作の id は重ならず、開く画面が実在し、欄の key は操作の中で重ならない', () => {
  const ids = new Set<string>()
  for (const a of AGENT_ACTIONS) {
    assert.ok(!ids.has(a.id), `重なる id: ${a.id}`)
    ids.add(a.id)
    assert.ok(routeExists(a.path), `画面が無い: ${a.path}`)
    const keys = a.fields.map((f) => f.key)
    assert.equal(new Set(keys).size, keys.length, `欄が重なる: ${a.id}`)
    for (const k of keys) assert.match(k, /^[a-z]{1,20}$/)
    assert.ok(a.finalStep.length > 0)
  }
  assert.ok(AGENT_ACTIONS.length >= 18)
  assert.ok(AGENT_PLAN_OPTIONS.some((p) => p.id === 'sales-prep'))
})

test('答えの形: 操作なら値を入れた URL と足りない欄、案だけなら一覧にあるものの画面', () => {
  const r = routeResponse({ kind: 'action', actionId: 'expense.contract.create', values: { amount: '200000' }, missing: [], reason: '支出の登録' }, '')
  assert.equal(r.kind, 'action')
  if (r.kind === 'action') {
    assert.equal(r.href, '/expense?to=new-contract')
    assert.deepEqual(r.values, { amount: '200000' })
    assert.deepEqual(r.missing, [])
  }
  const m = routeResponse({ kind: 'action', actionId: 'shodan.prep.create', values: {}, missing: ['url'], reason: '' }, '')
  assert.equal(m.kind === 'action' && m.missing.map((f) => f.key).join(), 'url')
  const u = routeResponse({ kind: 'unknown', reason: '', suggestions: ['quote.create'] }, '')
  assert.equal(u.kind === 'unknown' && u.suggestions[0].href, '/quote')
  assert.equal(routeResponse({ kind: 'plan', reason: '', planId: 'sales-prep' }, '').kind, 'plan')
})

test('AI を使えないとき: 言葉の一致で近いツールを案内し、合わなければ空（行き止まりの文は画面が出す）', () => {
  const f = fallbackRoute('見積書を作りたい')
  assert.equal(f.kind === 'unknown' && f.suggestions[0].href, '/quote')
  const n = fallbackRoute('今日の天気')
  assert.deepEqual(n.kind === 'unknown' && n.suggestions, [])
})

test('入口: 決めた行き先と一度きりの鍵（doya_k）だけを組織の中へ運ぶ。値そのものは運ばない', () => {
  const allow = { 'new-contract': '/contracts/new' }
  const k = 'abcdefghijklmnop1234'
  assert.equal(forwardPath(new URLSearchParams(`to=new-contract&doya_k=${k}&doya_amount=200000&evil=1`), allow), `/contracts/new?doya_k=${k}`)
  assert.equal(forwardPath(new URLSearchParams(`to=../../admin&doya_k=${k}`), allow), `?doya_k=${k}`)
  assert.equal(forwardPath(new URLSearchParams('to=__proto__'), allow), '')
  assert.equal(forwardPath(new URLSearchParams('doya_k=../x'), allow), '')
  assert.equal(forwardPath(null, allow), '')
  assert.equal(toSearchParams({ to: 'new-contract', doya_k: [k, 'x'], x: undefined }).toString(), `to=new-contract&doya_k=${k}`)
})

test('入口: URL に doya_ が無いときは、何も運ばない（今までどおり組織の最初の画面へ）', () => {
  assert.equal(forwardPath(new URLSearchParams(''), { 'new-contract': '/contracts/new' }), '')
  assert.equal(forwardPath(new URLSearchParams('utm_source=x'), { 'new-contract': '/contracts/new' }), '')
})
