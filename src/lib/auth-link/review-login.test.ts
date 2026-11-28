import test from 'node:test'
import assert from 'node:assert/strict'
import { reviewLogin, REVIEW_LOGIN_MAX_ATTEMPTS, REVIEW_LOGIN_WINDOW_MS, type AuthDeps } from './app-auth-service'
import { readReviewLoginConfig, isForbiddenReviewEmail } from './review-login'
import { MemoryRepo } from './testing/memory-repo'

// 試験用の値だけを使う。本物のメール・コード・DB には触れない。
const CFG = { email: 'reviewer@review.example.jp', code: 'test-code-12345678' }
let clock = new Date('2026-11-25T03:00:00Z')

function setup(userOver: Record<string, unknown> = {}) {
  const repo = new MemoryRepo()
  repo.addUser({ id: 'rv-1', email: CFG.email, emailNormalized: CFG.email, name: '審査用', plan: 'FREE', ...userOver })
  let n = 1
  const deps: AuthDeps = {
    repo, now: () => clock,
    randomBytes: (size) => { const k = n++; return Uint8Array.from({ length: size }, (_, i) => (k * 37 + i * 11) & 0xff) },
    getJwks: async () => ({ keys: [] }), audiences: { google: [], apple: [] },
    sendMail: async () => ({ success: true }),
  }
  return { deps, repo }
}
const ok = (over: Record<string, unknown> = {}) => ({ email: CFG.email, code: CFG.code, platform: 'ios', ...over })

test('審査用ログイン: 正しいメールとコードでトークンが返り、端末の行ができる', async () => {
  const { deps, repo } = setup()
  const r = await reviewLogin(deps, ok(), CFG)
  assert.equal(r.status, 200)
  assert.ok((r.body as any).accessToken && (r.body as any).refreshToken)
  assert.equal(repo.devices.length, 1)
  assert.equal(repo.devices[0].deviceLabel, '審査用ログイン')
  assert.equal(JSON.stringify(r.body).includes(CFG.email), false, 'メールを返さない')
})

test('審査用ログイン: メール違い・コード違い・ユーザー無しは、同じ 401（理由を出さない）', async () => {
  const bad1 = await reviewLogin(setup().deps, ok({ email: 'other@example.com' }), CFG)
  const bad2 = await reviewLogin(setup().deps, ok({ code: 'wrong-code-00000000' }), CFG)
  const empty = new MemoryRepo()
  const none = await reviewLogin({ ...setup().deps, repo: empty }, ok(), CFG)
  for (const r of [bad1, bad2, none]) { assert.equal(r.status, 401); assert.deepEqual(r.body, { code: 'INVALID_CREDENTIALS' }) }
})

test('審査用ログイン: ユーザーは作らない（無ければ失敗）', async () => {
  const repo = new MemoryRepo()
  const { deps } = setup()
  const r = await reviewLogin({ ...deps, repo }, ok(), CFG)
  assert.equal(r.status, 401)
  assert.equal(repo.users.size, 0)
})

test('審査用ログイン: 管理者（ADMIN）と退会済みは通さない', async () => {
  assert.equal((await reviewLogin(setup({ role: 'ADMIN' }).deps, ok(), CFG)).status, 401)
  assert.equal((await reviewLogin(setup({ deletedAt: new Date('2026-11-01') }).deps, ok(), CFG)).status, 401)
})

test('審査用ログイン: 15分で5回まで。超えたら正しいコードでも 429。次の枠で戻る', async () => {
  const { deps } = setup()
  for (let i = 0; i < REVIEW_LOGIN_MAX_ATTEMPTS; i++) {
    assert.equal((await reviewLogin(deps, ok({ code: `wrong-${i}-0000000000` }), CFG)).status, 401)
  }
  const blocked = await reviewLogin(deps, ok(), CFG)
  assert.equal(blocked.status, 429)
  assert.deepEqual(blocked.body, { code: 'TOO_MANY_ATTEMPTS' })
  clock = new Date(clock.getTime() + REVIEW_LOGIN_WINDOW_MS)
  assert.equal((await reviewLogin(deps, ok(), CFG)).status, 200)
})

test('審査用ログイン: 合わないメールでは、審査用の枠の回数を減らさない', async () => {
  const { deps } = setup()
  for (let i = 0; i < 20; i++) await reviewLogin(deps, ok({ email: `x${i}@example.com` }), CFG)
  assert.equal((await reviewLogin(deps, ok(), CFG)).status, 200)
})

test('審査用ログイン: 入力の形が不正なら 400', async () => {
  const { deps } = setup()
  assert.equal((await reviewLogin(deps, null, CFG)).status, 400)
  assert.equal((await reviewLogin(deps, ok({ platform: 'web' }), CFG)).status, 400)
})

test('審査用ログインの設定: 旗・メール・8文字以上のコードがそろったときだけ有効', () => {
  const full = { APP_AUTH_ENABLED: '1', APP_REVIEW_LOGIN_ENABLED: '1', APP_REVIEW_LOGIN_EMAIL: 'Reviewer@Review.Example.jp', APP_REVIEW_LOGIN_CODE: 'abcdefgh' }
  assert.deepEqual(readReviewLoginConfig(full), { email: 'reviewer@review.example.jp', code: 'abcdefgh' })
  assert.equal(readReviewLoginConfig({ ...full, APP_AUTH_ENABLED: undefined }), null)
  assert.equal(readReviewLoginConfig({ ...full, APP_REVIEW_LOGIN_ENABLED: undefined }), null)
  assert.equal(readReviewLoginConfig({ ...full, APP_REVIEW_LOGIN_ENABLED: '0' }), null)
  assert.equal(readReviewLoginConfig({ ...full, APP_REVIEW_LOGIN_EMAIL: undefined }), null)
  assert.equal(readReviewLoginConfig({ ...full, APP_REVIEW_LOGIN_CODE: 'short' }), null)
  assert.equal(readReviewLoginConfig({}), null)
})

test('審査用ログインの設定: 管理画面に入れる surisuta.jp のメールは使えない', () => {
  assert.equal(isForbiddenReviewEmail('a@surisuta.jp'), true)
  assert.equal(isForbiddenReviewEmail('a@mail.surisuta.jp'), true)
  assert.equal(isForbiddenReviewEmail('a@notsurisuta.jp'), false)
  const env = { APP_AUTH_ENABLED: '1', APP_REVIEW_LOGIN_ENABLED: '1', APP_REVIEW_LOGIN_EMAIL: 'x@surisuta.jp', APP_REVIEW_LOGIN_CODE: 'abcdefgh' }
  assert.equal(readReviewLoginConfig(env), null)
})

test('審査用ログインの回数の枠は、結び付けの確認（send-code・confirm）の待ちとして使えない', async () => {
  const { sendLinkCode, confirmLink, REVIEW_LOGIN_WINDOW_MS: W } = await import('./app-auth-service')
  const { deps, repo } = setup()
  await reviewLogin(deps, ok({ code: 'wrong-code-00000000' }), CFG) // 枠の行ができる
  const id = `review-login-${Math.floor(clock.getTime() / W)}`
  assert.ok(repo.links.has(id))
  const before = repo.links.get(id)!.attempts
  const sent = await sendLinkCode(deps, { requestId: id })
  assert.equal(sent.status, 410)
  const confirmed = await confirmLink(deps, { authorization: null, body: { requestId: id, code: '123456' } })
  assert.ok(confirmed.status === 410 || confirmed.status === 401, `status ${confirmed.status}`)
  assert.equal(repo.links.get(id)!.attempts, before, '回数を減らされない')
  assert.equal(repo.links.get(id)!.codeHash, null, '確認コードを置かれない')
})
