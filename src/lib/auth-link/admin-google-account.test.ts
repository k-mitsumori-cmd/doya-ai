import test from 'node:test'
import assert from 'node:assert/strict'
import { isAdminGoogleAccount } from './admin-google-account'

test('google の Account があり、Google が返したメールが @surisuta.jp なら通る', () => {
  assert.equal(isAdminGoogleAccount({ userEmail: 'x@example.com', accounts: [{ provider: 'google', providerEmail: 'a@surisuta.jp', emailVerified: true }] }), true)
})

test('google の Account が無く、User.email だけが @surisuta.jp なら通らない（Apple だけのユーザー）', () => {
  assert.equal(isAdminGoogleAccount({ userEmail: 'a@surisuta.jp', accounts: [{ provider: 'apple', providerEmail: 'a@surisuta.jp', emailVerified: true }] }), false)
  assert.equal(isAdminGoogleAccount({ userEmail: 'a@surisuta.jp', accounts: [] }), false)
  assert.equal(isAdminGoogleAccount({ userEmail: 'a@surisuta.jp', accounts: null }), false)
})

test('控えのメールが無い既存の Google の行は、User.email で判定する（従来と同じ結果）', () => {
  assert.equal(isAdminGoogleAccount({ userEmail: 'a@surisuta.jp', accounts: [{ provider: 'google' }] }), true)
  assert.equal(isAdminGoogleAccount({ userEmail: 'a@example.com', accounts: [{ provider: 'google', providerEmail: null }] }), false)
})

test('Google が返したメールが @surisuta.jp でなければ、User.email が @surisuta.jp でも通らない', () => {
  assert.equal(isAdminGoogleAccount({ userEmail: 'a@surisuta.jp', accounts: [{ provider: 'google', providerEmail: 'a@gmail.com', emailVerified: true }] }), false)
})

test('Google がメールを確認済みでないと明示している行は通さない', () => {
  assert.equal(isAdminGoogleAccount({ userEmail: 'a@surisuta.jp', accounts: [{ provider: 'google', providerEmail: 'a@surisuta.jp', emailVerified: false }] }), false)
})

test('ドメインの偽装（surisuta.jp.evil.example、sub ドメイン、複数の @）は通さない', () => {
  for (const e of ['a@surisuta.jp.evil.example', 'a@evil.surisuta.jp', 'a@surisuta.jpx', 'a@b@surisuta.jp', 'a@surisuta.jp ']) {
    assert.equal(isAdminGoogleAccount({ userEmail: 'x', accounts: [{ provider: 'google', providerEmail: e }] }), false, e)
  }
})

test('Account が複数あるとき、google の行が1つ条件を満たせば通る', () => {
  assert.equal(isAdminGoogleAccount({ userEmail: 'x@example.com', accounts: [{ provider: 'apple', providerEmail: 'z@privaterelay.appleid.com' }, { provider: 'google', providerEmail: 'a@SURISUTA.jp', emailVerified: true }] }), true)
})

// 修正4-4: Apple を足しても、管理画面の入口が弱くならない

test('Google の控えのメールがあっても、確認済みと記録されていない（null）行は通さない', () => {
  assert.equal(isAdminGoogleAccount({ userEmail: 'a@surisuta.jp', accounts: [{ provider: 'google', providerEmail: 'a@surisuta.jp', emailVerified: null }] }), false)
  assert.equal(isAdminGoogleAccount({ userEmail: 'a@surisuta.jp', accounts: [{ provider: 'google', providerEmail: 'a@surisuta.jp' }] }), false)
})

test('Apple を足したユーザーは、Google の控えが無い行を User.email で代用させない（User.email が Apple 由来かもしれない）', () => {
  assert.equal(isAdminGoogleAccount({ userEmail: 'a@surisuta.jp', accounts: [{ provider: 'google' }, { provider: 'apple', providerEmail: 'a@surisuta.jp', emailVerified: true }] }), false)
  // 控えがある Google の行なら、Apple があっても通る
  assert.equal(isAdminGoogleAccount({ userEmail: 'a@surisuta.jp', accounts: [{ provider: 'google', providerEmail: 'a@surisuta.jp', emailVerified: true }, { provider: 'apple' }] }), true)
})

test('Apple だけで、User.email が @surisuta.jp でも（確認済みでも未確認でも）通らない', () => {
  assert.equal(isAdminGoogleAccount({ userEmail: 'a@surisuta.jp', accounts: [{ provider: 'apple', providerEmail: 'a@surisuta.jp', emailVerified: false }] }), false)
  assert.equal(isAdminGoogleAccount({ userEmail: 'a@surisuta.jp', accounts: [{ provider: 'apple' }] }), false)
})
