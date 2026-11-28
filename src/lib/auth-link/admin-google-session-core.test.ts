import test from 'node:test'
import assert from 'node:assert/strict'
import { decideAdminGoogleSession } from './admin-google-session-core'

const g = (providerEmail: string | null = null) => [{ provider: 'google', providerEmail, emailVerified: (providerEmail ? true : null) as boolean | null }]
const run = (session: any, appAuthOn: boolean, accounts: any[] = [], spy?: string[]) =>
  decideAdminGoogleSession({ session, appAuthOn, listGoogleAccounts: async (id) => { spy?.push(id); return accounts } })

test('旗オフ: 今までと同じ（user.email が @surisuta.jp ならよい）。DB は読まない', async () => {
  const spy: string[] = []
  assert.equal(await run({ user: { id: 'u', email: 'a@surisuta.jp' } }, false, [], spy), true)
  assert.equal(await run({ user: { email: 'a@SURISUTA.JP' } }, false, [], spy), true)
  assert.equal(await run({ user: { id: 'u', email: 'a@example.com' } }, false, g('a@surisuta.jp'), spy), false)
  assert.equal(await run(null, false), false)
  assert.equal(await run({ user: {} }, false), false)
  assert.deepEqual(spy, [])
})

test('旗オン: Google の Account があり、そのメールが @surisuta.jp なら通る。控えが無い既存の行は User.email で判定する（従来の管理者が入れる）', async () => {
  assert.equal(await run({ user: { id: 'u', email: 'a@surisuta.jp' } }, true, g(null)), true)
  assert.equal(await run({ user: { id: 'u', email: 'x@example.com' } }, true, g('a@surisuta.jp')), true)
})

test('旗オン: Google の Account が無い（Apple だけ）なら、User.email が @surisuta.jp でも通らない。ID が無いセッションも通らない', async () => {
  assert.equal(await run({ user: { id: 'u', email: 'a@surisuta.jp' } }, true, []), false)
  assert.equal(await run({ user: { email: 'a@surisuta.jp' } }, true, g(null)), false)
  assert.equal(await run(null, true, g(null)), false)
})

test('旗オン: Google が @surisuta.jp でないメールを返したなら、User.email が @surisuta.jp でも通らない', async () => {
  assert.equal(await run({ user: { id: 'u', email: 'a@surisuta.jp' } }, true, g('a@gmail.com')), false)
})
