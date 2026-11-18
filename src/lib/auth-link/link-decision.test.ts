import test from 'node:test'
import assert from 'node:assert/strict'
import { decideLink, type LinkInput } from './link-decision'

const base = (over: Partial<LinkInput> & { identity?: Partial<LinkInput['identity']> } = {}): LinkInput => ({
  identity: { provider: 'apple', providerAccountId: 'apple-sub-1', email: 'taro@example.com', emailVerified: true, ...over.identity },
  existingAccount: over.existingAccount ?? null,
  userByEmail: over.userByEmail ?? null,
  currentUserId: over.currentUserId ?? null,
})

test('同じ (provider, sub) の Account があれば、メールを見ずに login-existing', () => {
  const d = decideLink(base({ existingAccount: { userId: 'u1' }, userByEmail: { userId: 'u2' } }))
  assert.deepEqual(d, { action: 'login-existing', userId: 'u1' })
  // メールが無くても、未確認でも同じ
  assert.deepEqual(decideLink(base({ existingAccount: { userId: 'u1' }, identity: { email: null, emailVerified: null } })), { action: 'login-existing', userId: 'u1' })
})

test('ログイン中のユーザーと Account の持ち主が同じなら login-existing、違えば reject（ほかのユーザーのログイン手段は移さない）', () => {
  assert.deepEqual(decideLink(base({ existingAccount: { userId: 'u1' }, currentUserId: 'u1' })), { action: 'login-existing', userId: 'u1' })
  assert.deepEqual(decideLink(base({ existingAccount: { userId: 'u2' }, currentUserId: 'u1' })), { action: 'reject', reason: 'identity-belongs-to-other-user' })
})

test('ログイン中で Account が無ければ link-to-current（メールは見ない）', () => {
  assert.deepEqual(decideLink(base({ currentUserId: 'u1', userByEmail: { userId: 'u9' } })), { action: 'link-to-current', userId: 'u1' })
  assert.deepEqual(decideLink(base({ currentUserId: 'u1', identity: { email: null, emailVerified: null } })), { action: 'link-to-current', userId: 'u1' })
})

test('同じメールの既存ユーザーがいれば require-confirmation（自動で結び付けない・新しいユーザーを作らない）', () => {
  const d = decideLink(base({ userByEmail: { userId: 'u1' } }))
  assert.equal(d.action, 'require-confirmation')
  if (d.action === 'require-confirmation') {
    assert.equal(d.targetUserId, 'u1')
    assert.deepEqual([...d.methods], ['previous-login', 'email-code'])
  }
})

test('メールが一致するユーザーがいなければ create-user（store）', () => {
  assert.deepEqual(decideLink(base()), { action: 'create-user', emailPolicy: 'store' })
})

test('未確認のメールは照合に使わない（既存ユーザーが渡されても無視して、メールは入れない）', () => {
  assert.deepEqual(decideLink(base({ identity: { provider: 'google', emailVerified: false }, userByEmail: { userId: 'u1' } })), { action: 'create-user', emailPolicy: 'omit' })
  assert.deepEqual(decideLink(base({ identity: { emailVerified: null }, userByEmail: { userId: 'u1' } })), { action: 'create-user', emailPolicy: 'omit' })
})

test('メールが無い（Apple の2回め以降など）は create-user（omit）', () => {
  assert.deepEqual(decideLink(base({ identity: { email: null, emailVerified: null } })), { action: 'create-user', emailPolicy: 'omit' })
})

test('Apple の隠したメールは、確認済みでも照合に使わず、連絡用に控える（contact-only）', () => {
  const d = decideLink(base({ identity: { email: 'abc@privaterelay.appleid.com', emailVerified: true }, userByEmail: { userId: 'u1' } }))
  assert.deepEqual(d, { action: 'create-user', emailPolicy: 'contact-only' })
  // 未確認の隠したメールは入れない
  assert.deepEqual(decideLink(base({ identity: { email: 'abc@privaterelay.appleid.com', emailVerified: false } })), { action: 'create-user', emailPolicy: 'omit' })
})

test('メールの大文字・空白の違いは、同じメールとして扱われる（照合は呼び出し側が normalizeEmail で引く前提。ここでは matchable の判定が崩れない）', () => {
  const d = decideLink(base({ identity: { email: '  TARO@Example.com ' }, userByEmail: { userId: 'u1' } }))
  assert.equal(d.action, 'require-confirmation')
})

test('不正な入力は reject', () => {
  assert.deepEqual(decideLink(base({ identity: { provider: '' } })), { action: 'reject', reason: 'invalid-input' })
  assert.deepEqual(decideLink(base({ identity: { providerAccountId: '  ' } })), { action: 'reject', reason: 'invalid-input' })
  assert.deepEqual(decideLink(base({ existingAccount: { userId: '' } })), { action: 'reject', reason: 'invalid-input' })
  assert.deepEqual(decideLink(null as any), { action: 'reject', reason: 'invalid-input' } as any)
})

test('対応していない提供元は reject', () => {
  assert.deepEqual(decideLink(base({ identity: { provider: 'facebook' } })), { action: 'reject', reason: 'unsupported-provider' })
  assert.deepEqual(decideLink(base({ identity: { provider: 'credentials' }, existingAccount: { userId: 'u1' } })), { action: 'reject', reason: 'unsupported-provider' })
})
