import test from 'node:test'
import assert from 'node:assert/strict'
import { isTrialEligible } from './trial'
import { decideStarter, starterCanonicalEmailHash, starterEmailHash, starterEmailHashesForLookup } from './pricing-v2/starter'
import { isGmailAddress } from './auth-link/email-normalize'

// 修正4-1: Apple の「メールを隠す」の人に、初月無料と最初の100が二重に付かない（迷うときは付けない）

const base = { stripeCustomerId: null, plan: 'FREE', servicePlans: [] as string[] }

test('初月無料: Apple の隠しメールは対象外。Stripe は照会しない', async () => {
  const r = await isTrialEligible({ ...base, email: 'abc123@privaterelay.appleid.com' })
  assert.equal(r, false)
})

test('初月無料: 大文字・前後の空白があっても隠しメールを見分ける', async () => {
  assert.equal(await isTrialEligible({ ...base, email: '  ABC@PrivateRelay.AppleID.com ' }), false)
})

test('初月無料: 同じ人の別の User のメールが隠しメールなら対象外', async () => {
  assert.equal(await isTrialEligible({ ...base, email: 'taro@example.com', siblingEmails: ['x@privaterelay.appleid.com'] }), false)
})

test('初月無料: 同じ人の別の User が有料なら対象外（servicePlans に混ぜて渡す）', async () => {
  assert.equal(await isTrialEligible({ ...base, email: 'taro@example.com', servicePlans: ['PRO'] }), false)
})

const ok = { ledgerAllowed: true, tablesAllowed: true, hasCompany: true, isOwner: true, email: 'a@example.com', verified: true, claimed: false }

test('最初の100: 隠しメールには付けない。理由は private_relay', () => {
  assert.deepEqual(decideStarter({ ...ok, email: 'abc@privaterelay.appleid.com' }), { ok: false, reason: 'private_relay' })
  assert.deepEqual(decideStarter({ ...ok, email: 'ABC@PrivateRelay.AppleID.com' }), { ok: false, reason: 'private_relay' })
})

test('最初の100: ふつうのメールは今までどおり付く。受け取り済み（別の User の分も含む）は付けない', () => {
  assert.deepEqual(decideStarter(ok), { ok: true })
  assert.deepEqual(decideStarter({ ...ok, claimed: true }), { ok: false, reason: 'already_claimed' })
})

// 2026-11-25 三森さんの決定: Gmail のドット違い・「+」付きは、初月無料と最初の100の判定で同じ人として扱う

test('最初の100: Gmail のドット違い・「+」付き・googlemail.com は同じ要約になる', () => {
  const a = starterCanonicalEmailHash('taro.yamada@gmail.com')
  assert.equal(starterCanonicalEmailHash('taroyamada@gmail.com'), a)
  assert.equal(starterCanonicalEmailHash('Taro.Yamada+news@Gmail.com'), a)
  assert.equal(starterCanonicalEmailHash('taroyamada@googlemail.com'), a)
})

test('最初の100: Gmail 以外は、ドットも「+」も別の宛先として扱う（別人を同じ人にしない）', () => {
  assert.notEqual(starterCanonicalEmailHash('taro.yamada@example.com'), starterCanonicalEmailHash('taroyamada@example.com'))
  assert.notEqual(starterCanonicalEmailHash('taro+a@example.com'), starterCanonicalEmailHash('taro@example.com'))
})

test('最初の100: 別の Gmail の人とは別の要約になる', () => {
  assert.notEqual(starterCanonicalEmailHash('taro@gmail.com'), starterCanonicalEmailHash('jiro@gmail.com'))
})

test('最初の100: 照会には旧形式の要約も含める（既に記録された分を見逃さない）', () => {
  const hs = starterEmailHashesForLookup('taro.yamada@gmail.com')
  assert.ok(hs.includes(starterEmailHash('taro.yamada@gmail.com')))
  assert.ok(hs.includes(starterCanonicalEmailHash('taro.yamada@gmail.com')))
  // 要約の先頭の版（v1 / v2）が違うため、Gmail 以外でも旧形式と新形式の2つを照会する
  assert.equal(starterEmailHashesForLookup('a@example.com').length, 2)
})

test('Gmail 系の見分け', () => {
  assert.equal(isGmailAddress('A.B@GMAIL.com'), true)
  assert.equal(isGmailAddress('a@googlemail.com'), true)
  assert.equal(isGmailAddress('a@example.com'), false)
  assert.equal(isGmailAddress(null), false)
})
