// 実行: npx tsx --test src/lib/agent-router/router.test.ts
// 依頼を読んでツールと操作を選ぶ仕組みの回帰テスト。本物の AI は呼ばない（偽物の client を渡す）。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cleanValues, isPrefillKey, missingFields, normalizeValue, stashPrefill, takePrefill, withPrefillKey, PREFILL_TTL_MS } from './prefill'
import { catalogText, validateReply, jstToday } from './router'
import { agentRouterModel, askRouter, buildRouterRequest } from './claude.server'
import type { AgentAction } from './types'

const expense: AgentAction = {
  id: 'expense.contract.create', toolId: 'expense', label: '支出の契約を登録する', description: '固定費や外注費などの支払いを登録する',
  path: '/expense?to=new-contract', finalStep: '保存する',
  fields: [
    { key: 'title', label: '名称', type: 'text' },
    { key: 'amount', label: '金額', type: 'yen', required: true },
    { key: 'start', label: '開始日', type: 'date' },
  ],
}
const shodan: AgentAction = {
  id: 'shodan.prep.create', toolId: 'shodan', label: '商談の準備を作る', description: '相手の会社のサイトから調べる',
  path: '/shodan', finalStep: '「この企業の商談準備をつくる」を押す',
  fields: [{ key: 'url', label: '相手の会社のサイト', type: 'url', required: true }],
}
const actions = [expense, shodan]
const plans = [{ id: 'sales-prep', title: '商談の準備をまとめて進める', description: '調べる・見積・スライドを一度に' }]

test('値の形: 金額・日付・URL・メールを確かめ、合わないものは捨てる', () => {
  assert.equal(normalizeValue('yen', '200,000円'), '200000')
  assert.equal(normalizeValue('yen', 200000), '200000')
  assert.equal(normalizeValue('yen', '-5'), '')
  assert.equal(normalizeValue('yen', '二十万'), '')
  assert.equal(normalizeValue('date', '2026-11-02'), '2026-11-02')
  assert.equal(normalizeValue('date', '2026-02-30'), '')
  assert.equal(normalizeValue('url', 'example.co.jp'), 'https://example.co.jp/')
  assert.equal(normalizeValue('url', 'javascript:alert(1)'), '')
  assert.equal(normalizeValue('url', 'https://user:pw@example.com'), '')
  assert.equal(normalizeValue('email', 'a@example.com'), 'a@example.com')
  assert.equal(normalizeValue('email', 'not-mail'), '')
  assert.equal(normalizeValue('text', ''), '')
})

test('欄に無い名前の値は捨て、足りない必須の欄を返す', () => {
  const v = cleanValues(expense, { title: 'Notion', amount: '20000', evil: 'x' })
  assert.deepEqual(v, { title: 'Notion', amount: '20000' })
  assert.deepEqual(missingFields(expense, {}).map((f) => f.key), ['amount'])
  assert.deepEqual(missingFields(expense, v), [])
})

/** 試験用の sessionStorage（触った回数も数える） */
function memoryStorage() {
  const m = new Map<string, string>()
  const touched: string[] = []
  return {
    touched,
    size: () => m.size,
    getItem: (k: string) => { touched.push('get'); return m.has(k) ? m.get(k)! : null },
    setItem: (k: string, v: string) => { touched.push('set'); m.set(k, v) },
    removeItem: (k: string) => { touched.push('remove'); m.delete(k) },
  }
}
const KEY = 'abcdefghijklmnop1234'

test('値は URL に載せず、一度きりの鍵だけを付ける。鍵で1回だけ取り出し、取り出したら消える', () => {
  const st = memoryStorage()
  const key = stashPrefill({ amount: '200000', client: '株式会社サンプル' }, st, 1000, () => KEY)
  assert.equal(key, KEY)
  const href = withPrefillKey('/expense?to=new-contract', key)
  assert.equal(href, `/expense?to=new-contract&doya_k=${KEY}`)
  assert.ok(!href.includes('200000') && !href.includes('%E6%A0%AA'), 'URL に値が載らない')
  assert.deepEqual(takePrefill(KEY, st, 2000), { amount: '200000', client: '株式会社サンプル' })
  assert.deepEqual(takePrefill(KEY, st, 2000), {}, '2回目は空')
  assert.equal(st.size(), 0)
})

test('鍵: 期限切れ・形の違う鍵・壊れた中身は空。値が無ければ鍵を作らない', () => {
  const st = memoryStorage()
  stashPrefill({ amount: '1' }, st, 0, () => KEY)
  assert.deepEqual(takePrefill(KEY, st, PREFILL_TTL_MS + 1), {})
  assert.equal(stashPrefill({}, st, 0, () => KEY), '')
  assert.equal(stashPrefill({ amount: '1' }, null, 0, () => KEY), '')
  assert.equal(stashPrefill({ amount: '1' }, st, 0, () => 'short'), '')
  assert.equal(isPrefillKey('../../x'), false)
  assert.equal(withPrefillKey('/quote', ''), '/quote')
  st.setItem('doya-prefill:' + KEY, '{broken')
  assert.deepEqual(takePrefill(KEY, st, 0), {})
})

test('URL に doya_k が無いときは、何もしない（保存場所に触れない）', () => {
  const st = memoryStorage()
  assert.deepEqual(takePrefill(null, st), {})
  assert.deepEqual(takePrefill('', st), {})
  assert.deepEqual(takePrefill(undefined, st), {})
  assert.deepEqual(st.touched, [])
})

test('AI の答え: 一覧にある操作だけを受け、値を確かめて、足りない欄を出す', () => {
  const r = validateReply({ kind: 'action', actionId: 'expense.contract.create', planId: '', values: [{ key: 'amount', value: '200000' }, { key: 'start', value: '来週' }], suggestions: [], reason: '支出の登録' }, actions, plans)
  assert.equal(r.kind, 'action')
  if (r.kind !== 'action') return
  assert.deepEqual(r.values, { amount: '200000' })
  assert.deepEqual(r.missing, [])
  const s = validateReply({ kind: 'action', actionId: 'shodan.prep.create', planId: '', values: [], suggestions: [], reason: '' }, actions, plans)
  assert.equal(s.kind === 'action' && s.missing.join(), 'url')
})

test('AI の答え: 知らない操作・形の違う答えは「どれにも合わない」にし、近い案は一覧にあるものだけ残す', () => {
  assert.equal(validateReply({ kind: 'action', actionId: 'nope', planId: '', values: [], suggestions: ['shodan.prep.create', 'x'], reason: '' }, actions, plans).kind, 'unknown')
  const u = validateReply({ kind: 'unknown', actionId: '', planId: '', values: [], suggestions: ['shodan.prep.create', 'x'], reason: '' }, actions, plans)
  assert.deepEqual(u.kind === 'unknown' && u.suggestions, ['shodan.prep.create'])
  assert.equal(validateReply(null, actions, plans).kind, 'unknown')
  assert.equal(validateReply({ kind: 'plan', actionId: '', planId: 'sales-prep', values: [], suggestions: [], reason: '' }, actions, plans).kind, 'plan')
  assert.equal(validateReply({ kind: 'plan', actionId: '', planId: 'nope', values: [], suggestions: [], reason: '' }, actions, plans).kind, 'unknown')
})

test('AI に送る中身: Opus 5.5・effort low・構造化出力・一覧をキャッシュ。temperature と前置きを送らない', () => {
  const req = buildRouterRequest('20万円支出を登録したい', '2026-10-28', actions, plans, agentRouterModel(''))
  assert.equal(req.model, 'claude-opus-5-5')
  assert.equal(req.output_config.effort, 'low')
  assert.ok(req.output_config.format)
  assert.equal(req.system[1].cache_control?.type, 'ephemeral')
  assert.ok(!('temperature' in req))
  assert.equal(req.messages.length, 1)
  assert.equal(req.messages[0].role, 'user')
  assert.ok(catalogText(actions, plans).includes('expense.contract.create'))
})

test('AI に聞く: 断られた・答えが無いときは null。鍵が無ければ呼ばない', async () => {
  const ok = { messages: { parse: async () => ({ stop_reason: 'end_turn', parsed_output: { kind: 'unknown' } }) } }
  assert.deepEqual(await askRouter('x', '2026-10-28', actions, plans, { client: ok }), { kind: 'unknown' })
  const refused = { messages: { parse: async () => ({ stop_reason: 'refusal', parsed_output: null }) } }
  assert.equal(await askRouter('x', '2026-10-28', actions, plans, { client: refused }), null)
  assert.equal(await askRouter('x', '2026-10-28', actions, plans, { apiKey: '' }), null)
})

test('日本時間の今日', () => {
  assert.equal(jstToday(Date.parse('2026-10-27T15:00:00Z')), '2026-10-28')
})
