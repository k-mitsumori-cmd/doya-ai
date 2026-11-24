import test from 'node:test'
import assert from 'node:assert/strict'
import { isTrialEligible } from './trial'
import { decideStarter } from './pricing-v2/starter'

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
