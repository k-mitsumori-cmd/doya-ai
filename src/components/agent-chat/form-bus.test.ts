// 実行: npx tsx --test src/components/agent-chat/form-bus.test.ts
// 画面と会話の通り道（form-bus）と、1字ずつ入れる動き（typeInto）の回帰テスト。ブラウザは使わず、window だけ用意する。
import { test } from 'node:test'
import assert from 'node:assert/strict'

;(globalThis as unknown as { window: unknown }).window = globalThis

async function load() {
  const bus = await import('./form-bus')
  const motion = await import('./motion')
  return { bus, motion }
}
const handler = (ready: () => boolean) => ({ setValue: () => true, snapshot: () => ({}), submit: async () => ({ ok: true as const, href: '/x' }), ready })

test('フォームが現れて入力できる状態になるまで待つ。時間切れは null', async () => {
  const { bus } = await load()
  let ok = false
  const unregister = bus.registerAgentForm('t.form', handler(() => ok))
  const waiting = bus.waitForAgentForm('t.form', 1000)
  setTimeout(() => { ok = true }, 150)
  assert.ok(await waiting)
  unregister()
  assert.equal(bus.getAgentForm('t.form'), undefined)
  assert.equal(await bus.waitForAgentForm('t.form', 200), null)
  // 登録はしたが、入力できる状態にならない（取引先の一覧を読み終えない）ときも null
  const u2 = bus.registerAgentForm('t.form2', handler(() => false))
  assert.equal(await bus.waitForAgentForm('t.form2', 250), null)
  u2()
})

test('登録の解除は、自分の登録だけを消す（あとから同じ名前で登録し直した画面を消さない）', async () => {
  const { bus } = await load()
  const a = handler(() => true)
  const b = handler(() => true)
  const ua = bus.registerAgentForm('t.same', a)
  const ub = bus.registerAgentForm('t.same', b)
  ua()
  assert.equal(bus.getAgentForm('t.same'), b)
  ub()
  assert.equal(bus.getAgentForm('t.same'), undefined)
})

test('1字ずつ入れる: 途中の値を順に渡し、止めると続きを入れない', async () => {
  const { motion } = await load()
  const seen: string[] = []
  await motion.typeInto('abc', (v) => seen.push(v), () => true)
  assert.deepEqual(seen, ['a', 'ab', 'abc'])
  const seen2: string[] = []
  let n = 0
  await motion.typeInto('abcd', (v) => seen2.push(v), () => ++n <= 2)
  assert.deepEqual(seen2, ['a', 'ab'])
  const one: string[] = []
  await motion.typeInto('x', (v) => one.push(v), () => true)
  assert.deepEqual(one, ['x'])
})
