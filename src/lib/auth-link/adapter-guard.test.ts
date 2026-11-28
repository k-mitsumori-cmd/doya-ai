import test from 'node:test'
import assert from 'node:assert/strict'
import type { Adapter } from 'next-auth/adapters'
import { guardAppSessionExpiry } from './adapter-guard'

function fake() {
  const updated: Array<{ sessionToken: string; expires?: Date }> = []
  const adapter = {
    getSessionAndUser: async () => null,
    deleteSession: async () => undefined,
    updateSession: async (s: { sessionToken: string; expires?: Date }) => { updated.push(s); return null },
  } as unknown as Adapter
  return { adapter, updated }
}
const appTokens = new Set(['app-token'])
const isApp = async (t: string) => appTokens.has(t)

test('アプリのセッションの updateSession は、期限を延ばさない（元の関数を呼ばない）', async () => {
  const { adapter, updated } = fake()
  const g = guardAppSessionExpiry(adapter, isApp)
  await g.updateSession!({ sessionToken: 'app-token', expires: new Date('2030-01-01') })
  assert.equal(updated.length, 0)
})

test('Web のセッションの updateSession は、従来どおり元の関数に渡る（expires もそのまま）', async () => {
  const { adapter, updated } = fake()
  const g = guardAppSessionExpiry(adapter, isApp)
  const exp = new Date('2030-01-01')
  await g.updateSession!({ sessionToken: 'web-token', expires: exp })
  assert.deepEqual(updated, [{ sessionToken: 'web-token', expires: exp }])
})

test('ほかの関数はそのまま。updateSession が無い adapter は、包まずに返す', async () => {
  const { adapter } = fake()
  const g = guardAppSessionExpiry(adapter, isApp)
  assert.equal(g.getSessionAndUser, adapter.getSessionAndUser)
  assert.equal(g.deleteSession, adapter.deleteSession)
  const bare = {} as Adapter
  assert.equal(guardAppSessionExpiry(bare, isApp), bare)
})

test('アプリのセッションの判定が失敗したら、例外を投げる（延ばす側に黙って倒さない）', async () => {
  const { adapter } = fake()
  const g = guardAppSessionExpiry(adapter, async () => { throw new Error('db') })
  await assert.rejects(async () => { await g.updateSession!({ sessionToken: "x" }) })
})
