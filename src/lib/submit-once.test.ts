import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { createOnce, isOnceResolve, onceOperationId, resolveOnce, type OnceScope } from './submit-once'
import { ONCE_SAVED_MESSAGE, onceFingerprint, submitOnce, SubmitOnceSavedError } from './submit-once-client'

const OP = '11111111-1111-4111-8111-111111111111'
class Fail extends Error { constructor(readonly status: number, message: string) { super(message) } }
const fail = (status: number, message: string) => new Fail(status, message)
const scope = (over: Partial<OnceScope> = {}): OnceScope => ({ family: 'test', organizationId: 'org', actorId: 'user', operationId: OP, fail, ...over })

function fakeTx() {
  const rows = new Map<string, string>()
  const tx = {
    $executeRaw: async () => 1,
    systemSetting: {
      findUnique: async ({ where }: { where: { key: string } }) => (rows.has(where.key) ? { value: rows.get(where.key)! } : null),
      create: async ({ data }: { data: { key: string; value: string } }) => { rows.set(data.key, data.value); return data },
    },
  }
  return { tx: tx as never, rows }
}

function maker() {
  const made: { id: string }[] = []
  return {
    made,
    find: async (id: string) => made.find((m) => m.id === id) ?? null,
    create: async () => { const row = { id: `row${made.length + 1}` }; made.push(row); return row },
  }
}

test('同じ番号と中身の送り直しは、新しく作らず前の物を返す', async () => {
  const { tx } = fakeTx(); const m = maker()
  const first = await createOnce(tx, scope(), { a: 1, operationId: OP }, m.find, m.create)
  const again = await createOnce(tx, scope(), { a: 1, operationId: OP }, m.find, m.create)
  assert.equal(first.replayed, false); assert.equal(again.replayed, true)
  assert.equal(again.entry.id, first.entry.id); assert.equal(m.made.length, 1)
})

test('同じ番号で中身が違う送信は、作らずに止める', async () => {
  const { tx } = fakeTx(); const m = maker()
  await createOnce(tx, scope(), { a: 1 }, m.find, m.create)
  await assert.rejects(createOnce(tx, scope(), { a: 2 }, m.find, m.create), (e: Fail) => e.status === 409)
  assert.equal(m.made.length, 1)
})

test('番号なしの古い画面の送信は、今までどおり毎回作る', async () => {
  const { tx, rows } = fakeTx(); const m = maker()
  await createOnce(tx, scope({ operationId: null }), { a: 1 }, m.find, m.create)
  await createOnce(tx, scope({ operationId: null }), { a: 1 }, m.find, m.create)
  assert.equal(m.made.length, 2); assert.equal(rows.size, 0)
})

test('組織と人が違えば、同じ番号でも別の送信として扱う', async () => {
  const { tx } = fakeTx(); const m = maker()
  await createOnce(tx, scope(), { a: 1 }, m.find, m.create)
  const other = await createOnce(tx, scope({ organizationId: 'org2' }), { a: 1 }, m.find, m.create)
  const person = await createOnce(tx, scope({ actorId: 'user2' }), { a: 1 }, m.find, m.create)
  assert.equal(other.replayed, false); assert.equal(person.replayed, false); assert.equal(m.made.length, 3)
})

test('状態の確認は登録せず、未保存なら取り消しを残して遅れた送信を止める', async () => {
  const { tx } = fakeTx(); const m = maker()
  assert.deepEqual(await resolveOnce(tx, scope(), m.find), { state: 'cancelled' })
  assert.equal(m.made.length, 0)
  await assert.rejects(createOnce(tx, scope(), { a: 1 }, m.find, m.create), (e: Fail) => e.status === 409)
  assert.equal(m.made.length, 0)
})

test('状態の確認は、保存ずみなら found、消されていれば gone を返す', async () => {
  const { tx } = fakeTx(); const m = maker()
  const { entry } = await createOnce(tx, scope(), { a: 1 }, m.find, m.create)
  assert.deepEqual(await resolveOnce(tx, scope(), m.find), { state: 'found', id: entry.id })
  m.made.length = 0
  assert.deepEqual(await resolveOnce(tx, scope(), m.find), { state: 'gone' })
})

test('番号の形を確かめる', () => {
  assert.equal(onceOperationId({}, fail), null)
  assert.equal(onceOperationId({ operationId: OP.toUpperCase() }, fail), OP)
  assert.throws(() => onceOperationId({ operationId: 'x' }, fail), (e: Fail) => e.status === 400)
  assert.equal(isOnceResolve({ onceAction: 'resolve' }), true)
  assert.equal(isOnceResolve({ onceAction: 'other' }), false)
})

// ---- 画面の側 ----
const realWindow = (globalThis as { window?: unknown }).window
beforeEach(() => {
  const store = new Map<string, string>()
  ;(globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v) },
      removeItem: (k: string) => { store.delete(k) },
    },
  }
})
afterEach(() => { (globalThis as { window?: unknown }).window = realWindow })

const httpError = (status: number) => Object.assign(new Error('失敗'), { status })
const never = async () => { throw new Error('状態の確認は呼ばれないはず') }

test('通信に失敗したら、同じ内容の送り直しに同じ番号を使う', async () => {
  const ids: (string | undefined)[] = []
  const send = async (id: string | undefined) => { ids.push(id); if (ids.length === 1) throw new TypeError('network'); return 'ok' }
  await assert.rejects(submitOnce({ scope: 's', input: { a: 1 }, send, resolve: never }))
  assert.equal(await submitOnce({ scope: 's', input: { a: 1 }, send, resolve: never }), 'ok')
  assert.equal(ids[0], ids[1]); assert.ok(ids[0])
})

test('成功のあとの同じ内容は、別の登録として新しい番号を使う', async () => {
  const ids: (string | undefined)[] = []
  const send = async (id: string | undefined) => { ids.push(id); return 'ok' }
  await submitOnce({ scope: 's', input: { a: 1 }, send, resolve: never })
  await submitOnce({ scope: 's', input: { a: 1 }, send, resolve: never })
  assert.notEqual(ids[0], ids[1])
})

test('4xx は登録されていないので控えを消す。5xx は結果が分からないので残す', async () => {
  const ids: (string | undefined)[] = []
  let status = 400
  const send = async (id: string | undefined) => { ids.push(id); throw httpError(status) }
  await assert.rejects(submitOnce({ scope: 's', input: { a: 1 }, send, resolve: never }))
  await assert.rejects(submitOnce({ scope: 's', input: { a: 1 }, send, resolve: never }))
  assert.notEqual(ids[0], ids[1])
  status = 500
  await assert.rejects(submitOnce({ scope: 't', input: { a: 1 }, send, resolve: never }))
  await assert.rejects(submitOnce({ scope: 't', input: { a: 1 }, send, resolve: never }))
  assert.equal(ids[2], ids[3])
})

test('内容を変えて送るときは先に確かめ、保存ずみなら今回は送らない', async () => {
  const sent: unknown[] = []
  const send = async (id: string | undefined) => { sent.push(id); if (sent.length === 1) throw new TypeError('network'); return 'ok' }
  await assert.rejects(submitOnce({ scope: 's', input: { a: 1 }, send, resolve: never }))
  await assert.rejects(
    submitOnce({ scope: 's', input: { a: 2 }, send, resolve: async () => 'found' }),
    (e: Error) => e instanceof SubmitOnceSavedError && e.message === ONCE_SAVED_MESSAGE,
  )
  assert.equal(sent.length, 1)
  // 知らせたあとは控えが消えているので、本人がもう一度押せば登録できる
  assert.equal(await submitOnce({ scope: 's', input: { a: 2 }, send, resolve: never }), 'ok')
})

test('内容を変えて送るとき、前回が未保存なら新しい番号で送る', async () => {
  const ids: (string | undefined)[] = []
  const send = async (id: string | undefined) => { ids.push(id); if (ids.length === 1) throw new TypeError('network'); return 'ok' }
  await assert.rejects(submitOnce({ scope: 's', input: { a: 1 }, send, resolve: never }))
  assert.equal(await submitOnce({ scope: 's', input: { a: 2 }, send, resolve: async () => 'cancelled' }), 'ok')
  assert.notEqual(ids[0], ids[1])
})

test('状態を確かめられないときは送らない', async () => {
  const sent: unknown[] = []
  const send = async (id: string | undefined) => { sent.push(id); if (sent.length === 1) throw new TypeError('network'); return 'ok' }
  await assert.rejects(submitOnce({ scope: 's', input: { a: 1 }, send, resolve: never }))
  await assert.rejects(submitOnce({ scope: 's', input: { a: 2 }, send, resolve: async () => { throw new TypeError('network') } }))
  assert.equal(sent.length, 1)
})

test('控えが1日より古いと、内容が同じでも先に確かめる', async () => {
  const ids: (string | undefined)[] = []
  const send = async (id: string | undefined) => { ids.push(id); return 'ok' }
  const w = (globalThis as unknown as { window: { localStorage: Storage } }).window
  w.localStorage.setItem('submit-once:pending:v1:s', JSON.stringify({ operationId: '22222222-2222-4222-8222-222222222222', fingerprint: onceFingerprint({ a: 1 }), at: Date.now() - 25 * 3600 * 1000 }))
  let asked = 0
  assert.equal(await submitOnce({ scope: 's', input: { a: 1 }, send, resolve: async () => { asked++; return 'cancelled' } }), 'ok')
  assert.equal(asked, 1); assert.notEqual(ids[0], '22222222-2222-4222-8222-222222222222')
})

test('ブラウザに控えられないときは、番号なしで今までどおり送る', async () => {
  (globalThis as { window?: unknown }).window = { localStorage: { setItem: () => { throw new Error('blocked') } } }
  const ids: (string | undefined)[] = []
  assert.equal(await submitOnce({ scope: 's', input: { a: 1 }, send: async (id) => { ids.push(id); return 'ok' }, resolve: never }), 'ok')
  assert.deepEqual(ids, [undefined])
})
