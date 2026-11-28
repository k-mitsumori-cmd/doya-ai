import test from 'node:test'
import assert from 'node:assert/strict'
import { webSignInGuard } from './web-signin-guard'
import { decideWebSignIn } from './app-auth-service'
import { MemoryRepo } from './testing/memory-repo'

// 修正4-2: Web の Google ログインを、アプリと同じ結び付けの決まりにそろえる（旗がオフなら今までどおり）

function setup(appAuthEnabled: boolean) {
  const repo = new MemoryRepo()
  let decideCalls = 0
  const ctx = {
    appAuthEnabled,
    decide: async (i: Parameters<typeof decideWebSignIn>[1]) => { decideCalls++; return decideWebSignIn(repo, i) },
  }
  return { repo, ctx, calls: () => decideCalls }
}
const g = (email: string) => ({ providerAccountId: 'g-1', profile: { email, email_verified: true } })

test('旗オフ: Google は決まりを通さず、DB も読まない（今までどおり）', async () => {
  const { repo, ctx, calls } = setup(false)
  repo.addUser({ id: 'u1', email: 'taro@example.com', emailNormalized: 'taro@example.com', emailVerifiedForLink: true })
  assert.equal(await webSignInGuard('google', g('taro@example.com'), ctx), true)
  assert.equal(calls(), 0)
})

test('旗オン: Apple を先に使った人が同じメールの Google で入ると、行き止まりにせず確認の手順（待ち）へ誘導する', async () => {
  const { repo, ctx } = setup(false)
  repo.addUser({ id: 'u1', email: 'taro@example.com', emailNormalized: 'taro@example.com', emailVerifiedForLink: true })
  const on = { ...ctx, appAuthEnabled: true }
  const to = await webSignInGuard('google', g('Taro@Example.com'), on)
  assert.equal(to, '/auth/signin?error=LinkConfirmationRequired') // linkRequests 無しの decide では、案内つきのエラー画面。待ちの作成は auth.ts 側の decide が行う
  assert.notEqual(to, true)
})

test('旗オン（待ちを作る decide）: Google は /auth/link?request=<id> の確認の画面へ。メールは URL に入らない', async () => {
  const repo = new MemoryRepo()
  repo.addUser({ id: 'u1', email: 'taro@example.com', emailNormalized: 'taro@example.com', emailVerifiedForLink: true })
  const lr = { repo, now: new Date('2026-11-24T00:00:00Z'), randomBytes: (n: number) => Uint8Array.from({ length: n }, (_, i) => (i * 7 + 3) & 0xff) }
  const ctx = { appAuthEnabled: true, decide: (i: Parameters<typeof decideWebSignIn>[1]) => decideWebSignIn(repo, i, lr) }
  const to = await webSignInGuard('google', g('taro@example.com'), ctx)
  assert.match(String(to), /^\/auth\/link\?request=[A-Za-z0-9_-]{16,}$/)
  assert.ok(!String(to).includes('taro'))
})

test('旗オン: 同じ Google の Account がある既存の人・初めての人・未確認のメールは、今までどおり通る', async () => {
  const { repo, ctx } = setup(false)
  const on = { ...ctx, appAuthEnabled: true }
  repo.addUser({ id: 'u1', email: 'taro@example.com', emailNormalized: 'taro@example.com', emailVerifiedForLink: true })
  await repo.addAccount('u1', { provider: 'google', providerAccountId: 'g-1', providerEmail: 'taro@example.com', emailVerified: true })
  assert.equal(await webSignInGuard('google', g('taro@example.com'), on), true)
  assert.equal(await webSignInGuard('google', { providerAccountId: 'g-new', profile: { email: 'new@example.com', email_verified: true } }, on), true)
  assert.equal(await webSignInGuard('google', { providerAccountId: 'g-x', profile: { email: 'taro@example.com', email_verified: false } }, on), true)
})

test('旗オン: 決まりの処理が失敗しても、Google の既存ログインは止めない（今までの動きに任せる）。Apple は拒否', async () => {
  const boom = { appAuthEnabled: true, decide: async () => { throw new Error('db down') } }
  assert.equal(await webSignInGuard('google', g('a@example.com'), boom), true)
  assert.equal(await webSignInGuard('apple', g('a@example.com'), boom), '/auth/signin?error=AccessDenied')
})

test('ほかの提供元は何もしない', async () => {
  const { ctx, calls } = setup(true)
  assert.equal(await webSignInGuard('github', g('a@example.com'), ctx), true)
  assert.equal(await webSignInGuard(undefined, g('a@example.com'), ctx), true)
  assert.equal(calls(), 0)
})
