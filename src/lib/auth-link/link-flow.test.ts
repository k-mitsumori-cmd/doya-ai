import test from 'node:test'
import assert from 'node:assert/strict'
import { afterConfirm, afterSend, canSubmitCode, initialView, isPlausibleRequestId, sanitizeCodeInput, stepText, type LinkStep } from './link-flow'

const ID = 'a'.repeat(43)

test('initialView: 待ちの ID があれば案内。無い・形が悪いときは invalid。未確認のメールは unverified', () => {
  assert.equal(initialView({ request: ID, error: null }).step, 'intro')
  assert.equal(initialView({ request: null, error: null }).step, 'invalid')
  assert.equal(initialView({ request: 'short', error: null }).step, 'invalid')
  assert.equal(initialView({ request: '../etc', error: null }).step, 'invalid')
  assert.equal(initialView({ request: null, error: 'LINK_TARGET_UNVERIFIED' }).step, 'unverified')
  assert.equal(isPlausibleRequestId(ID), true)
})

test('afterSend: 送れた・送信済み・期限切れ・メール無し・送信失敗', () => {
  const ok = afterSend({ status: 200, body: { sent: true, emailHint: 't***@example.com' } })
  assert.equal(ok.step, 'code'); assert.equal(ok.emailHint, 't***@example.com'); assert.match(ok.notice ?? '', /15分/)
  const again = afterSend({ status: 409, body: { code: 'CODE_ALREADY_SENT' } })
  assert.equal(again.step, 'code'); assert.equal(again.error, null); assert.match(again.notice ?? '', /すでに/)
  assert.equal(afterSend({ status: 410, body: { code: 'LINK_REQUEST_EXPIRED' } }).step, 'expired')
  assert.equal(afterSend({ status: 422, body: { code: 'NO_EMAIL' } }).step, 'unverified')
  const failed = afterSend({ status: 502, body: { code: 'EMAIL_SEND_FAILED' } })
  assert.equal(failed.step, 'intro'); assert.match(failed.error ?? '', /送れませんでした/)
  assert.equal(afterSend({ status: 500, body: null }).step, 'intro')
})

test('afterConfirm: 成功・コードの誤り（残り回数）・上限・期限切れ・使用済み・その他', () => {
  const prev = afterSend({ status: 200, body: { emailHint: 't***@example.com' } })
  assert.equal(afterConfirm(prev, { status: 200, body: { linked: true } }).step, 'done')
  const wrong = afterConfirm(prev, { status: 400, body: { code: 'LINK_CODE_INVALID', remainingAttempts: 3 } })
  assert.equal(wrong.step, 'code'); assert.equal(wrong.remainingAttempts, 3); assert.match(wrong.error ?? '', /あと3回/); assert.equal(wrong.emailHint, 't***@example.com')
  const last = afterConfirm(prev, { status: 400, body: { code: 'LINK_CODE_INVALID', remainingAttempts: 0 } })
  assert.equal(last.error, '確認コードが違います。')
  assert.equal(afterConfirm(prev, { status: 429, body: { code: 'LINK_TOO_MANY_ATTEMPTS' } }).step, 'locked')
  assert.equal(afterConfirm(prev, { status: 410, body: { code: 'LINK_REQUEST_EXPIRED' } }).step, 'expired')
  assert.equal(afterConfirm(prev, { status: 409, body: { code: 'LINK_REQUEST_USED' } }).step, 'expired')
  assert.equal(afterConfirm(prev, { status: 409, body: { code: 'IDENTITY_TAKEN' } }).step, 'invalid')
  assert.equal(afterConfirm(prev, { status: 409, body: { code: 'CODE_NOT_SENT' } }).step, 'intro')
  assert.equal(afterConfirm(prev, { status: 500, body: null }).step, 'code')
  // 成功の応答に linked が無ければ成功にしない
  assert.equal(afterConfirm(prev, { status: 200, body: {} }).step, 'code')
})

test('コード欄: 数字だけ・6桁まで・全角も半角へ。6桁そろったときだけ送れる', () => {
  assert.equal(sanitizeCodeInput('12 34-56789'), '123456')
  assert.equal(sanitizeCodeInput('１２３４５６'), '123456')
  assert.equal(sanitizeCodeInput('abc'), '')
  assert.equal(canSubmitCode('12345'), false)
  assert.equal(canSubmitCode('123456'), true)
})

test('文言: 全部の状態に見出しと本文がある。「！」・絵文字・コードやメールの値を含まない', () => {
  const steps: LinkStep[] = ['intro', 'code', 'done', 'expired', 'locked', 'unverified', 'invalid']
  for (const s of steps) {
    const t = stepText(s)
    assert.ok(t.title.length > 0 && t.body.length > 0, s)
    assert.equal(/[!！\p{Extended_Pictographic}]/u.test(t.title + t.body), false, s)
  }
  assert.match(stepText('unverified').body, /お問い合わせ/)
  assert.match(stepText('done').title, /ログイン手段を追加しました/)
})
