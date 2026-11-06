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

test('権限などで操作できないフォームは、blocked の理由を返す（会話は値を入れる前に止まる）', async () => {
  const { bus } = await load()
  const reason = '支出の登録には、担当者以上の権限が必要です。'
  const off = bus.registerAgentForm('t.blocked', { ...handler(() => true), setValue: () => false, blocked: () => reason })
  const h = await bus.waitForAgentForm('t.blocked', 500)
  assert.equal(h?.blocked?.(), reason)
  assert.equal(h?.setValue('amount', '1'), false)
  off()
  // blocked を持たないフォームは、今までどおり（理由なし）
  const off2 = bus.registerAgentForm('t.free', handler(() => true))
  assert.equal((await bus.waitForAgentForm('t.free', 500))?.blocked, undefined)
  off2()
})

test('会話から保存しているあいだだけ、フォームは通知と画面の移動をしない（isAgentSubmit）。失敗しても元に戻る。403 は権限がない失敗', async () => {
  const { bus } = await load()
  assert.equal(bus.isAgentSubmit(), false)
  let seen: boolean[] = []
  await bus.runAgentSubmit(async () => { seen.push(bus.isAgentSubmit()); await new Promise((r) => setTimeout(r, 10)); seen.push(bus.isAgentSubmit()) })
  assert.deepEqual(seen, [true, true])
  assert.equal(bus.isAgentSubmit(), false)
  await assert.rejects(bus.runAgentSubmit(async () => { throw new Error('x') }))
  assert.equal(bus.isAgentSubmit(), false, '失敗のあとも、立てたままにしない')
  // 入れ子でも、外側が終わるまで立つ
  await bus.runAgentSubmit(async () => { await bus.runAgentSubmit(async () => {}); assert.equal(bus.isAgentSubmit(), true) })
  assert.equal(bus.failKindOf({ status: 403 }), 'blocked')
  assert.equal(bus.failKindOf({ status: 500 }), undefined)
  assert.equal(bus.failKindOf(new Error('x')), undefined)
  assert.equal(bus.failKindOf(null), undefined)
})

test('選択肢の画面から本物のフォームへ運ぶ: accept を渡すと、選択肢の画面の登録は返さず、本物のフォームが現れるまで待つ', async () => {
  const { bus } = await load()
  const moved: string[] = []
  const chooser = {
    ...handler(() => true),
    choices: () => ({ prompt: 'どのワークスペースで進めますか？', options: [{ id: 'acme', label: 'アクメ' }, { id: 'beta', label: 'ベータ' }] }),
    choose: (id: string) => { moved.push(id) },
  }
  const off = bus.registerAgentForm('t.choose', chooser)
  // accept なしなら、選択肢の画面が返る。会話はここで選択肢を読む
  const first = await bus.waitForAgentForm('t.choose', 500)
  assert.equal(first?.choices?.()?.options.length, 2)
  await first?.choose?.('beta')
  assert.deepEqual(moved, ['beta'])
  // accept つきでは、選択肢の画面が残っている間は返さない（時間切れは null）
  assert.equal(await bus.waitForAgentForm('t.choose', 250, (h) => !h.choices?.()), null)
  // 本物のフォームが同じ名前で登録されると、それが返る
  const real = handler(() => true)
  const waiting = bus.waitForAgentForm('t.choose', 1000, (h) => !h.choices?.())
  setTimeout(() => { bus.registerAgentForm('t.choose', real) }, 120)
  assert.equal(await waiting, real)
  // 選択肢の画面の解除は、あとから登録した本物のフォームを消さない
  off()
  assert.equal(bus.getAgentForm('t.choose'), real)
})

test('欄を出す準備（prepare）は、値を入れる前に1回だけ呼ぶ口。持たないフォームは今までどおり', async () => {
  const { bus } = await load()
  const log: string[] = []
  const off = bus.registerAgentForm('t.prepare', { ...handler(() => true), prepare: async () => { log.push('prepare') }, setValue: (k: string) => { log.push(`set:${k}`); return true } })
  const h = await bus.waitForAgentForm('t.prepare', 500)
  await h?.prepare?.()
  h?.setValue('name', 'x')
  assert.deepEqual(log, ['prepare', 'set:name'])
  off()
  const off2 = bus.registerAgentForm('t.noprepare', handler(() => true))
  assert.equal((await bus.waitForAgentForm('t.noprepare', 500))?.prepare, undefined)
  off2()
})
