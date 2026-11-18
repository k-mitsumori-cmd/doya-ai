import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeEmail, gmailCanonicalKey, isApplePrivateRelay } from './email-normalize'

test('normalizeEmail: 大文字と前後の空白だけ違うメールは同じ値になる', () => {
  assert.equal(normalizeEmail('  Taro.Yamada@Example.COM '), 'taro.yamada@example.com')
  assert.equal(normalizeEmail('taro.yamada@example.com'), normalizeEmail('TARO.YAMADA@EXAMPLE.COM\n'))
})

test('normalizeEmail: NFKC で全角の英数字・全角空白を半角にそろえる', () => {
  assert.equal(normalizeEmail('ＡＢＣ＠Ｅｘａｍｐｌｅ．ｃｏｍ'), 'abc@example.com')
  assert.equal(normalizeEmail('　abc@example.com　'), 'abc@example.com')
})

test('normalizeEmail: 既定では Gmail のドットと +タグは残す（別の列の扱い）', () => {
  assert.equal(normalizeEmail('a.b+x@gmail.com'), 'a.b+x@gmail.com')
  assert.notEqual(normalizeEmail('a.b@gmail.com'), normalizeEmail('ab@gmail.com'))
})

test('normalizeEmail: メールとして使えない入力は null', () => {
  for (const v of [undefined, null, 123, '', '   ', 'abc', '@example.com', 'abc@', 'a@b@c', 'a b@example.com', 'a\u0000b@example.com']) {
    assert.equal(normalizeEmail(v), null, String(v))
  }
})

test('gmailCanonicalKey: Gmail はドットと +タグを除き、googlemail.com を gmail.com にそろえる', () => {
  assert.equal(gmailCanonicalKey('A.B.C+news@Gmail.com'), 'abc@gmail.com')
  assert.equal(gmailCanonicalKey('abc@googlemail.com'), 'abc@gmail.com')
})

test('gmailCanonicalKey: Gmail 以外は +タグだけ除き、ドットは残す', () => {
  assert.equal(gmailCanonicalKey('a.b+x@example.com'), 'a.b@example.com')
  assert.equal(gmailCanonicalKey('+x@example.com'), null)
  assert.equal(gmailCanonicalKey('bad'), null)
})

test('isApplePrivateRelay: 中継のドメインだけを真にする', () => {
  assert.equal(isApplePrivateRelay('abc123@privaterelay.appleid.com'), true)
  assert.equal(isApplePrivateRelay('ABC123@PrivateRelay.AppleID.com'), true)
  assert.equal(isApplePrivateRelay('abc@icloud.com'), false)
  assert.equal(isApplePrivateRelay('abc@evil-privaterelay.appleid.com'), false)
  assert.equal(isApplePrivateRelay('abc@privaterelay.appleid.com.evil.example'), false)
  assert.equal(isApplePrivateRelay(null), false)
})
